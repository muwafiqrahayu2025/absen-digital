/**
 * ════════════════════════════════════════════════════════════════════
 * ABDI Absen Digital — Security & Encryption Unit Tests
 * tests/security.test.ts (Sprint 4 Task 14)
 * ════════════════════════════════════════════════════════════════════
 */

import CryptoJS from 'crypto-js';

// ── Mock localStorage untuk lingkungan node test ────────────────────
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => {
      for (const k in mockStorage) delete mockStorage[k];
    },
    get length() { return Object.keys(mockStorage).length; },
    key: (idx: number) => Object.keys(mockStorage)[idx] || null,
  };
}

// ── Test Runner Sederhana ──────────────────────────────────────────
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ABDI Security & Crypto Unit Test Suite              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Import modul localCrypto
  const {
    hashPassword,
    verifyPassword,
    encryptData,
    decryptData,
    recordFailedLogin,
    checkAccountLockout,
    resetLoginAttempts,
  } = await import('../src/lib/localCrypto');

  // ── TEST 1: Password Hashing (PBKDF2 + Salt) ───────────────────────
  console.log('1. Testing PBKDF2 Password Hashing:');
  const plain = 'RahasiaSuper2026!';
  const hashed = hashPassword(plain);

  assert(typeof hashed === 'string' && hashed.includes(':'), 'Hash format contains salt and key (salt:hash)');
  const [salt, key] = hashed.split(':');
  assert(salt.length === 32, 'Salt is 16 bytes hex (32 characters)');
  assert(key.length === 64, 'Hash is 256 bits hex (64 characters)');
  assert(verifyPassword(plain, hashed) === true, 'Correct password verifies successfully');
  assert(verifyPassword('WrongPassword123', hashed) === false, 'Incorrect password fails verification');
  assert(verifyPassword('', hashed) === false, 'Empty password fails verification');

  // Hash uniqueness (salting check)
  const hashed2 = hashPassword(plain);
  assert(hashed !== hashed2, 'Two hashes of the same password produce distinct salts and ciphertexts');

  // ── TEST 2: Local AES-256 Symmetric Encryption ────────────────────
  console.log('\n2. Testing AES-256 Local Encryption:');
  const sensitivePayload = {
    nik: '3201234567890001',
    name: 'Budi Santoso',
    role: 'guru',
  };

  const encrypted = encryptData(sensitivePayload);
  assert(typeof encrypted === 'string' && encrypted.length > 0, 'Encrypted output is non-empty string');
  assert(!encrypted.includes('3201234567890001'), 'Plaintext NIK is never visible in ciphertext');

  const decrypted = decryptData<typeof sensitivePayload>(encrypted);
  assert(decrypted !== null && decrypted.nik === '3201234567890001', 'Decrypted object preserves original properties');
  assert(decrypted?.name === 'Budi Santoso', 'Decrypted name matches');

  // Tamper / Corrupted data check
  const tampered = encrypted.substring(0, 10) + 'ABC' + encrypted.substring(13);
  const decryptedTampered = decryptData(tampered);
  assert(decryptedTampered === null || typeof decryptedTampered === 'string', 'Corrupted ciphertext does not crash application');

  // ── TEST 3: Rate Limiter & Lockout ─────────────────────────────────
  console.log('\n3. Testing Brute-Force Rate Limiter:');
  const testUser = 'tester_bruteforce';
  resetLoginAttempts(testUser);

  let initialCheck = checkAccountLockout(testUser);
  assert(initialCheck.isLocked === false, 'Fresh user is not locked');

  // Attempt 1 to 4
  for (let i = 1; i <= 4; i++) {
    const res = recordFailedLogin(testUser);
    assert(res.isLocked === false, `Attempt ${i} is not yet locked (${res.attemptsRemaining} remaining)`);
  }

  // Attempt 5 -> Lockout triggered
  const res5 = recordFailedLogin(testUser);
  assert(res5.isLocked === true, '5th consecutive failed attempt triggers account lockout');
  assert(res5.attemptsRemaining === 0, 'Zero attempts remaining after lockout');

  const lockedCheck = checkAccountLockout(testUser);
  assert(lockedCheck.isLocked === true, 'checkAccountLockout confirms user is currently locked');

  // Reset check
  resetLoginAttempts(testUser);
  const resetCheck = checkAccountLockout(testUser);
  assert(resetCheck.isLocked === false, 'Successful reset clears lockout');

  // ── TEST 4: Password Complexity Validator ─────────────────────────
  console.log('\n4. Testing Password Complexity Rules (SEC-004):');
  function validateNewPassword(pwd: string): { valid: boolean; message: string } {
    if (!pwd || pwd.trim().length < 8) {
      return { valid: false, message: 'Minimal 8 karakter' };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { valid: false, message: 'Perlu 1 huruf kapital' };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: 'Perlu 1 angka' };
    }
    return { valid: true, message: '' };
  }

  assert(validateNewPassword('123').valid === false, 'Password 3 chars rejected');
  assert(validateNewPassword('abcdefgh').valid === false, 'Password without uppercase & number rejected');
  assert(validateNewPassword('Abcdefgh').valid === false, 'Password without number rejected');
  assert(validateNewPassword('abcdefg1').valid === false, 'Password without uppercase rejected');
  assert(validateNewPassword('Abdi2026').valid === true, 'Valid password accepted (8 chars, 1 uppercase, 1 digit)');
  assert(validateNewPassword('SuperSecure#99').valid === true, 'Complex password accepted');

  // ── HASIL AKHIR ───────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`TOTAL: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('══════════════════════════════════════════════════════\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
