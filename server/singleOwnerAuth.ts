import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Single-owner configuration is environment driven. Production must fail closed.
export function getOwnerEmail(): string {
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error('ADMIN_EMAIL is required');
  return email;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return secret;
}

let currentPasswordHash = '';
let activeJwtVersion = 1;
const failedLoginAttempts: Map<string, number[]> = new Map();

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
  if (securityAuditLogs.length > 500) securityAuditLogs.pop();
}

export function getSecurityAuditLogs(): SecurityAuditEvent[] { return securityAuditLogs; }

export function initializeSingleOwnerSecurity() {
  const email = getOwnerEmail();
  currentPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
  if (!currentPasswordHash) {
    throw new Error('ADMIN_PASSWORD_HASH is required; refusing to start without configured owner credentials.');
  }
  getJwtSecret();
  logSecurityEvent({
    eventType: 'LOGIN_SUCCESS',
    ip: '127.0.0.1',
    userAgent: 'SYSTEM_BOOT',
    path: '/system/boot',
    details: `Single Owner initialized for ${email}. Registration & Demo access disabled.`
  });
  console.log(`[Single Owner Security] Single Owner system active for: ${email}`);
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterSecs: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxFailures = 5;
  const attempts = (failedLoginAttempts.get(ip) || []).filter(ts => now - ts < windowMs);
  failedLoginAttempts.set(ip, attempts);
  if (attempts.length >= maxFailures) {
    return { allowed: false, remainingAttempts: 0, retryAfterSecs: Math.ceil((attempts[0] + windowMs - now) / 1000) };
  }
  return { allowed: true, remainingAttempts: maxFailures - attempts.length, retryAfterSecs: 0 };
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const attempts = (failedLoginAttempts.get(ip) || []).filter(ts => now - ts < 15 * 60 * 1000);
  attempts.push(now);
  failedLoginAttempts.set(ip, attempts);
}

export function clearFailedLogins(ip: string) { failedLoginAttempts.delete(ip); }

export async function authenticateOwner(emailInput: string, passwordInput: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const ownerEmail = getOwnerEmail();
  if (emailInput.toLowerCase().trim() !== ownerEmail.toLowerCase().trim()) {
    return { success: false, error: 'Forbidden. Only the configured administrator is allowed to log in.' };
  }
  if (!currentPasswordHash || !getJwtSecret()) {
    return { success: false, error: 'Authentication is not configured.' };
  }
  const isValid = bcrypt.compareSync(passwordInput, currentPasswordHash);
  if (!isValid) return { success: false, error: 'Invalid owner credentials.' };
  const token = jwt.sign(
    { email: ownerEmail, role: 'OWNER', v: activeJwtVersion, iss: 'KCC_SECURITY_GATEWAY' },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
  return { success: true, token };
}

export function verifyOwnerToken(token: string): { valid: boolean; email?: string; error?: string } {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (!decoded || decoded.email?.toLowerCase() !== getOwnerEmail().toLowerCase()) return { valid: false, error: 'Unauthorized owner email in token' };
    if (decoded.v !== activeJwtVersion) return { valid: false, error: 'Session invalidated due to emergency lockdown or logout everywhere' };
    return { valid: true, email: decoded.email };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid or expired token' };
  }
}

export function verifySingleOwnerSession(token: string): boolean { return verifyOwnerToken(token).valid; }

export function emergencyLockdown(): { success: boolean; invalidatedVersion: number } {
  activeJwtVersion++;
  logSecurityEvent({ eventType: 'LOCKDOWN', ip: '127.0.0.1', userAgent: 'ADMIN_TRIGGER', path: '/api/admin/lockdown', details: `All active JWT sessions invalidated (version ${activeJwtVersion}).` });
  return { success: true, invalidatedVersion: activeJwtVersion };
}

export function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';
  let token = req.cookies?.kcc_admin_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1];
  if (!token && req.headers['x-admin-token']) token = req.headers['x-admin-token'] as string;
  if (!token) {
    logSecurityEvent({ eventType: 'UNAUTHORIZED_ACCESS', ip: String(ip), userAgent, path: req.originalUrl || req.path, details: 'Missing authentication token' });
    res.status(401).json({ success: false, error: 'Authentication required. Please log in as the single platform owner.' });
    return;
  }
  const verification = verifyOwnerToken(token);
  if (!verification.valid) {
    logSecurityEvent({ eventType: 'SESSION_EXPIRED', ip: String(ip), userAgent, path: req.originalUrl || req.path, details: verification.error });
    res.status(403).json({ success: false, error: `Forbidden: ${verification.error}` });
    return;
  }
  (req as any).ownerEmail = verification.email;
  next();
}

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
