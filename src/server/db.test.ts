import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './db.js';
import { DIGITAL_HUB_CATEGORY_ID } from '../utils/digitalHub.js';

test('database seeds all 5 existing cosmic categories plus DIGITAL LINK HUB', () => {
  const testDb = createDatabase(':memory:', null);
  try {
    const categories = testDb.getCategories();
    const names = categories.map((c) => c.name);
    assert.ok(names.includes('Quantum & Neural Intelligence'));
    assert.ok(names.includes('Deep Space & Astrometry'));
    assert.ok(names.includes('Bio-Cybernetics & Longevity'));
    assert.ok(names.includes('Cryptographic Substrates'));
    assert.ok(names.includes('High-Energy Particle Physics'));
    assert.ok(names.includes('DIGITAL LINK HUB'));

    const hubLinks = testDb.getLinks({ categoryId: DIGITAL_HUB_CATEGORY_ID });
    assert.ok(hubLinks.length >= 3, 'Should seed starter DIGITAL LINK HUB links');
  } finally {
    testDb.close();
  }
});

test('owner private password setup, verification, rotation, and hashed sessions work securely', () => {
  const testDb = createDatabase(':memory:', null);
  try {
    assert.equal(testDb.isOwnerConfigured(), false);
    // Rejects any password before owner configures it
    assert.equal(testDb.verifyOwnerPassword('FluxAdmin#2026!').valid, false);

    // First-time owner password creation
    const setupRes = testDb.setupOwnerPassword('OmegaVault!2026', 'omega_chief');
    assert.equal(setupRes.success, true);
    assert.equal(testDb.isOwnerConfigured(), true);
    assert.equal(setupRes.user?.username, 'omega_chief');

    // Second setup attempt must fail
    const duplicateSetup = testDb.setupOwnerPassword('AnotherPass#99');
    assert.equal(duplicateSetup.success, false);

    // Verification
    assert.equal(testDb.verifyOwnerPassword('WrongPass!123').valid, false);
    const verified = testDb.verifyOwnerPassword('OmegaVault!2026');
    assert.equal(verified.valid, true);
    assert.equal(verified.user?.role, 'admin');

    // Session creation & lookup
    const session = testDb.createSession(verified.user!.id, 'admin');
    const fetchedSession = testDb.getSession(session.token);
    assert.ok(fetchedSession);
    assert.equal(fetchedSession?.userId, verified.user!.id);

    // Password rotation invalidates other sessions
    const rotateBad = testDb.changeOwnerPassword('WrongCurrent!1', 'NewPass!2026');
    assert.equal(rotateBad.success, false);

    const rotateGood = testDb.changeOwnerPassword('OmegaVault!2026', 'NewOmega!2027');
    assert.equal(rotateGood.success, true);
    assert.equal(testDb.getSession(session.token), undefined);
    assert.equal(testDb.verifyOwnerPassword('OmegaVault!2026').valid, false);
    assert.equal(testDb.verifyOwnerPassword('NewOmega!2027').valid, true);
  } finally {
    testDb.close();
  }
});

test('invitation code validation enforces usage counts and atomic registration', () => {
  const testDb = createDatabase(':memory:', null);
  try {
    const code = testDb.findInvitationCode('FLUX-MEMBERSHIP-ALPHA');
    assert.ok(code, 'Initial invitation code must exist');
    assert.equal(code?.isActive, true);

    const invalidResult = testDb.validateAndClaimInvitation('NON-EXISTENT-CODE');
    assert.equal(invalidResult.valid, false);

    const regBad = testDb.registerMemberWithInvitation({
      username: 'new_voyager',
      email: 'voyager@flux.space',
      passwordHash: 'hash',
      salt: 'salt',
      invitationCode: 'INVALID-CODE',
    });
    assert.equal(regBad.success, false);

    const regGood = testDb.registerMemberWithInvitation({
      username: 'new_voyager',
      email: 'voyager@flux.space',
      passwordHash: 'hash',
      salt: 'salt',
      invitationCode: 'OMEGA-COSMIC-PASS',
    });
    assert.equal(regGood.success, true);
    assert.equal(regGood.user?.role, 'member');

    const updatedInvite = testDb.findInvitationCode('OMEGA-COSMIC-PASS');
    assert.equal(updatedInvite?.timesUsed, 1);
  } finally {
    testDb.close();
  }
});

test('links retrieval, CRUD, and click recording work cleanly in isolated memory DB', () => {
  const testDb = createDatabase(':memory:', null);
  try {
    const spaceLinks = testDb.getLinks({ categoryId: 'cat_cosmic' });
    assert.ok(spaceLinks.length > 0);
    assert.ok(spaceLinks.every((l) => l.categoryId === 'cat_cosmic'));

    const created = testDb.createLink({
      title: 'Test Instagram Link',
      url: 'https://instagram.com/test',
      categoryId: DIGITAL_HUB_CATEGORY_ID,
      description: 'Social feed',
      tags: ['Instagram'],
      isFeatured: false,
      createdByUserId: 'usr_admin_master',
    });
    assert.equal(created.categoryId, DIGITAL_HUB_CATEGORY_ID);

    const newCount = testDb.recordLinkClick(created.id);
    assert.equal(newCount, 1);

    const updated = testDb.updateLink(created.id, { title: 'Updated Instagram Link' });
    assert.equal(updated?.title, 'Updated Instagram Link');

    assert.equal(testDb.deleteLink(created.id), true);
    assert.equal(testDb.getLinkById(created.id), undefined);
  } finally {
    testDb.close();
  }
});
