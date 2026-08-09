import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// 1. OWNER CONFIGURATION (ENVIRONMENT DRIVEN)
export function getOwnerEmail(): string {
  return process.env.ADMIN_EMAIL || 'samraboss@gmail.com';
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '';
}

let currentPasswordHash: string = process.env.ADMIN_PASSWORD_HASH || '';

// Active JWT Version for global session invalidation (Emergency Lockdown)
let activeJwtVersion: number = 1;

// Failed Login Attempt Rate Limiting Store: IP -> Array of timestamps
const failedLoginAttempts: Map<string, number[]> = new Map();

// Security Audit Event Logger
export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'UNAUTHORIZED_ACCESS' | 'BLOCKED_REQUEST' | 'SESSION_EXPIRED' | 'LOCKDOWN';
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
  currentPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';

  logSecurityEvent({
    eventType: 'LOGIN_SUCCESS',
    ip: '127.0.0.1',
    userAgent: 'SYSTEM_BOOT',
    path: '/system/boot',
    details: `Single Owner initialized for ${email}. Registration & Demo access permanently disabled.`
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

  // Verify Password
  if (!currentPasswordHash || !getJwtSecret()) {
    return { success: false, error: 'Authentication is not configured. Set ADMIN_PASSWORD_HASH and JWT_SECRET.' };
  }

  const isValid = bcrypt.compareSync(passwordInput, currentPasswordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid owner credentials.' };
  }

  // Generate JWT Token
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
    rateLimit: true,
    csrf: true,
    lockdownEndpoint: true,
    ownerTransferSupported: true,
    activeJwtVersion
  };
}
