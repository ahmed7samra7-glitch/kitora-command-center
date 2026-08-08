import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:3000';


async function runPhase7aVerification() {
  console.log('====================================================');
  console.log('PHASE 7A — SINGLE OWNER SECURITY & ADMIN CONTROL VERIFICATION');
  console.log('====================================================\n');

  try {
    // 1. GET /api/admin/security-audit
    console.log('1. Checking Security Audit Summary (/api/admin/security-audit)...');
    const auditRes = await fetch(`${BASE_URL}/api/admin/security-audit`);
    if (!auditRes.ok) {
      throw new Error(`Security Audit endpoint failed with status ${auditRes.status}`);
    }
    const auditData = await auditRes.json();
    console.log('Audit Summary Response:', JSON.stringify(auditData, null, 2));

    if (!auditData.singleOwner) throw new Error('singleOwner field is not true');
    if (!auditData.registrationDisabled) throw new Error('registrationDisabled is not true');
    if (auditData.ownerEmail !== 'samraboss@gmail.com') throw new Error(`ownerEmail '${auditData.ownerEmail}' does not match expected 'samraboss@gmail.com'`);

    // 2. Test Unauthenticated Access to Protected Endpoint
    console.log('\n2. Testing Unauthenticated Access to Protected Route (/api/policies)...');
    const unauthRes = await fetch(`${BASE_URL}/api/policies`);
    console.log(`Unauthenticated Response: HTTP ${unauthRes.status}`);
    if (unauthRes.status !== 401 && unauthRes.status !== 403) {
      throw new Error(`Expected HTTP 401 or 403 for unauthenticated access, got ${unauthRes.status}`);
    }

    // 3. Test Registration Block
    console.log('\n3. Testing Registration & Signup Endpoint Block (/api/admin/register)...');
    const regRes = await fetch(`${BASE_URL}/api/admin/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unauthorized_user@gmail.com', password: 'Password123!' })
    });
    console.log(`Registration Block Response: HTTP ${regRes.status}`);
    const regData = await regRes.json();
    console.log('Response Body:', JSON.stringify(regData));
    if (regRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for registration attempt, got ${regRes.status}`);
    }

    // 4. Test Non-Owner Email Login Attempt
    console.log('\n4. Testing Non-Owner Email Login Attempt (hacker@gmail.com)...');
    const nonOwnerRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hacker@gmail.com', password: 'KccOwner2026!' })
    });
    console.log(`Non-Owner Login Response: HTTP ${nonOwnerRes.status}`);
    const nonOwnerData = await nonOwnerRes.json();
    console.log('Response Body:', JSON.stringify(nonOwnerData));
    if (nonOwnerRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for non-owner email, got ${nonOwnerRes.status}`);
    }

    // 5. Single Owner Valid Login
    console.log('\n5. Testing Single Owner Valid Login (samraboss@gmail.com)...');
    const validLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'samraboss@gmail.com', password: 'KccOwner2026!' })
    });
    console.log(`Valid Owner Login Response: HTTP ${validLoginRes.status}`);
    const validLoginData = await validLoginRes.json();
    console.log('Response Body:', JSON.stringify(validLoginData));

    if (!validLoginData.success || !validLoginData.token) {
      throw new Error('Valid owner login failed or token was not returned');
    }
    const ownerToken = validLoginData.token;

    // 6. Test Authenticated Access with Token
    console.log('\n6. Testing Authenticated Access to Protected Endpoint (/api/admin/security-audit/logs)...');
    const authLogsRes = await fetch(`${BASE_URL}/api/admin/security-audit/logs`, {
      headers: { 'x-admin-token': ownerToken }
    });
    console.log(`Authenticated Access Response: HTTP ${authLogsRes.status}`);
    const authLogsData = await authLogsRes.json();
    console.log('Audit Logs Count:', authLogsData.count);

    if (authLogsRes.status !== 200 || !authLogsData.success) {
      throw new Error(`Authenticated request failed with status ${authLogsRes.status}`);
    }

    // 7. Test Emergency Lockdown
    console.log('\n7. Testing Emergency Lockdown Endpoint (/api/admin/lockdown)...');
    const lockdownRes = await fetch(`${BASE_URL}/api/admin/lockdown`, {
      method: 'POST',
      headers: { 'x-admin-token': ownerToken }
    });
    console.log(`Lockdown Response: HTTP ${lockdownRes.status}`);
    const lockdownData = await lockdownRes.json();
    console.log('Lockdown Result:', JSON.stringify(lockdownData));

    if (!lockdownData.success) {
      throw new Error('Lockdown endpoint returned failure');
    }

    // 8. Verify Old Token Token Is Invalidated After Lockdown
    console.log('\n8. Verifying Old Token Is Invalidated After Lockdown...');
    const postLockdownRes = await fetch(`${BASE_URL}/api/admin/security-audit/logs`, {
      headers: { 'x-admin-token': ownerToken }
    });
    console.log(`Post-Lockdown Access with Old Token Response: HTTP ${postLockdownRes.status}`);
    if (postLockdownRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for old token after lockdown, got ${postLockdownRes.status}`);
    }

    console.log('\n====================================================');
    console.log('✅ PHASE 7A VERIFICATION COMPLETE — ALL REQUIREMENTS MET!');
    console.log('====================================================');

  } catch (err) {
    console.error('\nVerification Error:', err);
    process.exit(1);
  }
}

runPhase7aVerification();
