import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// 1. OWNER CONFIGURATION (ENVIRONMENT DRIVEN)
export function getOwnerEmail(): string {
  return process.env.ADMIN_EMAIL || 'samraboss@gmail.com';
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.KCC_SINGLE_OWNER_JWT_SECRET || process.env.SINGLE_OWNER_AUTH_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('SECURITY FATAL: Missing JWT secret configuration in environment. System failed closed.');
  }
  return secret.trim();
}

let currentPasswordHash: string | null = process.env.ADMIN_PASSWORD_HASH || null;

// Active JWT Version for global session invalidation (Emergency Lockdown)
let activeJwtVersion: number = 1;

// Failed Login Attempt Rate Limiting Store: IP -> Array of timestamps
const failedLoginAttempts: Map<string, number[]> = new Map();

// Security Audit Event Logger
export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'UNAUTHORIZED_ACCESS' | 'BLOCKED_REQUEST' | 'SESSION_EXPIRED' | 'LOCKDOWN' | 'SYSTEM_BOOT';
  ip: string;
  userAgent: string;
  path: string;
  details?: string;
}

const securityAuditLogs: SecurityAuditEvent[] = [];

export function logSecurityEvent(event: Omit<SecurityAuditEvent, 'id' | 'timestamp'>) {
  const entry: SecurityAuditEvent = {
    id: `SEC-LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...event
  };
  securityAuditLogs.unshift(entry);
  if (securityAuditLogs.length > 500) {
    securityAuditLogs.pop();
  }
}

export function getSecurityAuditLogs(): SecurityAuditEvent[] {
  return securityAuditLogs;
}

// FIRST BOOT INITIALIZATION
export function initializeSingleOwnerSecurity() {
  const email = getOwnerEmail();
  const hasJwtSecret = !!(process.env.JWT_SECRET || process.env.KCC_SINGLE_OWNER_JWT_SECRET || process.env.SINGLE_OWNER_AUTH_SECRET);
  const hasAdminPassword = !!(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD);

  if (!hasJwtSecret) {
    console.error('[Single Owner Security] 🚨 FATAL SECURITY CONFIGURATION: Missing JWT secret in environment.');
  }
  if (!hasAdminPassword) {
    console.error('[Single Owner Security] 🚨 FATAL SECURITY CONFIGURATION: Missing administrator password in environment.');
  }

  logSecurityEvent({
    eventType: 'SYSTEM_BOOT',
    ip: '127.0.0.1',
    userAgent: 'SYSTEM_BOOT',
    path: '/system/boot',
    details: `Single Owner initialized for ${email}. Secrets configured: JWT=${hasJwtSecret}, Pass=${hasAdminPassword}. Registration & Demo access permanently disabled.`
  });

  console.log(`[Single Owner Security] 🔒 Single Owner system active for: ${email}`);
}

// RATE LIMITING FAILED LOGINS (5 attempts per 15 min per IP)
export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterSecs: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxFailures = 5;

  const attempts = (failedLoginAttempts.get(ip) || []).filter(ts => now - ts < windowMs);
  failedLoginAttempts.set(ip, attempts);

  if (attempts.length >= maxFailures) {
    const oldest = attempts[0];
    const retryAfterSecs = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSecs };
  }

  return { allowed: true, remainingAttempts: maxFailures - attempts.length, retryAfterSecs: 0 };
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const attempts = (failedLoginAttempts.get(ip) || []).filter(ts => now - ts < windowMs);
  attempts.push(now);
  failedLoginAttempts.set(ip, attempts);
}

export function clearFailedLogins(ip: string) {
  failedLoginAttempts.delete(ip);
}

// AUTHENTICATION LOGIC
export async function authenticateOwner(emailInput: string, passwordInput: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const ownerEmail = getOwnerEmail();

  // Strict Single Owner Check
  if (emailInput.toLowerCase().trim() !== ownerEmail.toLowerCase().trim()) {
    return { success: false, error: 'Forbidden. Only the single configured administrator is allowed to log in.' };
  }

  const envHash = process.env.ADMIN_PASSWORD_HASH;
  const envPlain = process.env.ADMIN_PASSWORD;

  if (!envHash && !envPlain) {
    return { success: false, error: 'SECURITY FATAL: Missing administrator password configuration in environment. System failed closed.' };
  }

  let isValid = false;
  if (envPlain && passwordInput === envPlain) {
    isValid = true;
  } else if (envHash && bcrypt.compareSync(passwordInput, envHash)) {
    isValid = true;
  }

  if (!isValid) {
    return { success: false, error: 'Invalid owner credentials.' };
  }

  // Generate JWT Token (will throw if JWT_SECRET is missing)
  const token = jwt.sign(
    {
      email: ownerEmail,
      role: 'OWNER',
      v: activeJwtVersion,
      iss: 'KCC_SECURITY_GATEWAY'
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );

  return { success: true, token };
}

// JWT VERIFICATION
export function verifyOwnerToken(token: string): { valid: boolean; email?: string; error?: string } {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (!decoded || decoded.email?.toLowerCase() !== getOwnerEmail().toLowerCase()) {
      return { valid: false, error: 'Unauthorized owner email in token' };
    }
    if (decoded.v !== activeJwtVersion) {
      return { valid: false, error: 'Session invalidated due to emergency lockdown or logout everywhere' };
    }
    return { valid: true, email: decoded.email };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid or expired token' };
  }
}

export function verifySingleOwnerSession(token: string): boolean {
  return verifyOwnerToken(token).valid;
}

// EMERGENCY LOCKDOWN
export function emergencyLockdown(): { success: boolean; invalidatedVersion: number } {
  activeJwtVersion++;
  logSecurityEvent({
    eventType: 'LOCKDOWN',
    ip: '127.0.0.1',
    userAgent: 'ADMIN_TRIGGER',
    path: '/api/admin/lockdown',
    details: `EMERGENCY LOCKDOWN ACTIVATED. All active JWT sessions invalidated (New version: ${activeJwtVersion}).`
  });
  return { success: true, invalidatedVersion: activeJwtVersion };
}

// REQUIRE OWNER AUTH EXPRESS MIDDLEWARE
export function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // 1. Extract Token from Cookie, Authorization Header, or x-admin-token
  let token = req.cookies?.kcc_admin_token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token && req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'] as string;
  }

  if (!token) {
    logSecurityEvent({
      eventType: 'UNAUTHORIZED_ACCESS',
      ip: String(ip),
      userAgent,
      path: req.originalUrl || req.path,
      details: 'Missing authentication token'
    });
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in as the single platform owner.'
    });
    return;
  }

  // 2. Verify Token
  const verification = verifyOwnerToken(token);
  if (!verification.valid) {
    logSecurityEvent({
      eventType: 'SESSION_EXPIRED',
      ip: String(ip),
      userAgent,
      path: req.originalUrl || req.path,
      details: verification.error
    });
    res.status(403).json({
      success: false,
      error: `Forbidden: ${verification.error}`
    });
    return;
  }

  // Attach owner identity to request
  (req as any).ownerEmail = verification.email;
  next();
}

// SECURITY AUDIT SUMMARY SCHEMA
export function getSecurityAuditSummary(protectedRouteCount: number = 32) {
  return {
    singleOwner: true,
    registrationDisabled: true,
    ownerEmail: getOwnerEmail(),
    protectedRoutes: protectedRouteCount,
    authentication: 'ACTIVE',
    authorization: 'ACTIVE',
    demoAccessRemoved: true,
    jwt: 'ACTIVE',
    helmet: true,
    rateLimit: 'LOGIN_ONLY',
    csrf: false,
    lockdownEndpoint: true,
    ownerTransferSupported: true,
    activeJwtVersion
  };
}