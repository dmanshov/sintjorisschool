import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashPassword,
  validatePasswordStrength,
  verifyFirebaseHash,
  verifyPassword,
} from '../src/lib/auth/password';

/**
 * The published Firebase Auth scrypt test vector. If this test fails, existing
 * parents cannot log in after the migration, so treat it as a release blocker
 * rather than a flake.
 */
const FIREBASE_VECTOR = {
  params: {
    signerKey:
      'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==',
    saltSeparator: 'Bw==',
    rounds: 8,
    memCost: 14,
  },
  salt: '42xEC+ixf3L2lw==',
  passwordHash:
    'lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==',
  password: 'user1password',
};

test('verifyFirebaseHash accepts the correct password for the published vector', async () => {
  const ok = await verifyFirebaseHash(
    FIREBASE_VECTOR.password,
    FIREBASE_VECTOR.passwordHash,
    FIREBASE_VECTOR.salt,
    FIREBASE_VECTOR.params,
  );
  assert.equal(ok, true);
});

test('verifyFirebaseHash rejects a wrong password', async () => {
  const ok = await verifyFirebaseHash(
    'not-the-password',
    FIREBASE_VECTOR.passwordHash,
    FIREBASE_VECTOR.salt,
    FIREBASE_VECTOR.params,
  );
  assert.equal(ok, false);
});

test('our own hash format round-trips', async () => {
  const hash = await hashPassword('Correct Horse Battery Staple');
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/);

  const good = await verifyPassword('Correct Horse Battery Staple', {
    passwordHash: hash,
    legacyFirebaseHash: null,
    legacyFirebaseSalt: null,
  });
  assert.deepEqual(good, { ok: true, rehashTo: null });

  const bad = await verifyPassword('wrong', {
    passwordHash: hash,
    legacyFirebaseHash: null,
    legacyFirebaseSalt: null,
  });
  assert.deepEqual(bad, { ok: false, reason: 'mismatch' });
});

test('two hashes of the same password differ (salted)', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  assert.notEqual(a, b);
});

test('an account with no password material cannot log in', async () => {
  const result = await verifyPassword('anything', {
    passwordHash: null,
    legacyFirebaseHash: null,
    legacyFirebaseSalt: null,
  });
  assert.deepEqual(result, { ok: false, reason: 'no-password' });
});

test('a legacy hash is upgraded on a correct login', async () => {
  process.env.FIREBASE_HASH_SIGNER_KEY = FIREBASE_VECTOR.params.signerKey;
  process.env.FIREBASE_HASH_SALT_SEPARATOR = FIREBASE_VECTOR.params.saltSeparator;
  process.env.FIREBASE_HASH_ROUNDS = String(FIREBASE_VECTOR.params.rounds);
  process.env.FIREBASE_HASH_MEM_COST = String(FIREBASE_VECTOR.params.memCost);

  const result = await verifyPassword(FIREBASE_VECTOR.password, {
    passwordHash: null,
    legacyFirebaseHash: FIREBASE_VECTOR.passwordHash,
    legacyFirebaseSalt: FIREBASE_VECTOR.salt,
  });

  assert.equal(result.ok, true);
  assert.ok(result.ok && result.rehashTo, 'a correct legacy login must produce a new hash');

  // And the new hash must itself verify, otherwise the upgrade locks the user out.
  const reverify = await verifyPassword(FIREBASE_VECTOR.password, {
    passwordHash: result.ok ? result.rehashTo : null,
    legacyFirebaseHash: null,
    legacyFirebaseSalt: null,
  });
  assert.equal(reverify.ok, true);
});

test('password strength rules', () => {
  assert.ok(validatePasswordStrength('short') !== null);
  assert.equal(validatePasswordStrength('longenough123'), null);
});
