import { authenticateOwner, getSecurityAuditLogs, initializeSingleOwnerSecurity } from '../server/singleOwnerAuth.js';

async function main() {
  const keys = ['JWT_SECRET', 'KCC_SINGLE_OWNER_JWT_SECRET', 'SINGLE_OWNER_AUTH_SECRET', 'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD'];
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    initializeSingleOwnerSecurity();

    const boot = getSecurityAuditLogs()[0];
    if (boot?.eventType !== 'SYSTEM_BOOT') {
      throw new Error(`Security boot event was incorrectly classified as ${boot?.eventType || 'missing'}`);
    }

    if (getSecurityAuditLogs().some((entry) => entry.eventType === 'LOGIN_SUCCESS')) {
      throw new Error('Security boot emitted a false LOGIN_SUCCESS event');
    }

    const auth = await authenticateOwner('samraboss@gmail.com', 'anything');
    if (auth.success) {
      throw new Error('Owner authentication succeeded without configured credentials');
    }

    console.log('Security fail-closed verification: PASS');
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
