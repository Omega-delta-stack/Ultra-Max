import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  normalizeInviteCode,
  validatePasswordStrength,
  validateOwnerPasswordStrength,
  isValidUrl,
} from './auth-crypto.js';

test('hashPassword creates deterministic output given the same salt', () => {
  const salt = 'aabbccddeeff00112233445566778899';
  const res1 = hashPassword('SecretPassword123!', salt);
  const res2 = hashPassword('SecretPassword123!', salt);
  assert.equal(res1.hash, res2.hash);
  assert.equal(res1.salt, salt);
});

test('hashPassword generates distinct salts when salt is omitted', () => {
  const res1 = hashPassword('SamePassword');
  const res2 = hashPassword('SamePassword');
  assert.notEqual(res1.salt, res2.salt);
  assert.notEqual(res1.hash, res2.hash);
});

test('verifyPassword authenticates correct password and rejects incorrect password', () => {
  const password = 'CosmicFluxSuperKey2026';
  const { hash, salt } = hashPassword(password);
  assert.equal(verifyPassword(password, hash, salt), true);
  assert.equal(verifyPassword('WrongPassword', hash, salt), false);
  assert.equal(verifyPassword('', hash, salt), false);
  assert.equal(verifyPassword('a'.repeat(200), hash, salt), false);
});

test('generateSessionToken produces 64 character hex string and hashSessionToken hashes deterministically', () => {
  const token1 = generateSessionToken();
  const token2 = generateSessionToken();
  assert.equal(token1.length, 64);
  assert.notEqual(token1, token2);

  const h1 = hashSessionToken(token1);
  const h2 = hashSessionToken(token1);
  assert.equal(h1.length, 64);
  assert.equal(h1, h2);
  assert.notEqual(h1, token1);
});

test('normalizeInviteCode trims whitespace and converts to uppercase', () => {
  assert.equal(normalizeInviteCode('  flux-member-2026  '), 'FLUX-MEMBER-2026');
  assert.equal(normalizeInviteCode('alpha_nexus'), 'ALPHA_NEXUS');
});

test('validatePasswordStrength checks min and max length requirements', () => {
  assert.equal(validatePasswordStrength('12345').valid, false);
  assert.equal(validatePasswordStrength('123456').valid, true);
  assert.equal(validatePasswordStrength('a'.repeat(129)).valid, false);
});

test('validateOwnerPasswordStrength enforces length and complexity', () => {
  assert.equal(validateOwnerPasswordStrength('short1').valid, false);
  assert.equal(validateOwnerPasswordStrength('onlyletters').valid, false);
  assert.equal(validateOwnerPasswordStrength('OmegaOwner#2026').valid, true);
});

test('isValidUrl validates http and https URLs and rejects invalid strings', () => {
  assert.equal(isValidUrl('https://webbtelescope.org'), true);
  assert.equal(isValidUrl('http://cern.ch/datasets'), true);
  assert.equal(isValidUrl('not-a-url'), false);
  assert.equal(isValidUrl('javascript:alert(1)'), false);
});
