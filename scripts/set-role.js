'use strict';

/**
 * One-time bootstrap: promotes OWNER_BOOTSTRAP_EMAIL (from .env) to the
 * "owner" role. Run this once after the person has registered normally
 * through the website (so a Firebase Auth user + users/{uid} doc exist).
 *
 * Usage:
 *   1. Register an account on the site normally (becomes role: "user").
 *   2. Set OWNER_BOOTSTRAP_EMAIL=you@example.com in .env
 *   3. npm run set-owner
 *
 * This script is intentionally NOT an HTTP endpoint — promoting an
 * owner must never be reachable from the browser or the public API.
 */

require('dotenv').config();
const { admin, db, auth } = require('../server/firebase-admin');

async function main() {
  const email = process.env.OWNER_BOOTSTRAP_EMAIL;
  if (!email) {
    console.error('Set OWNER_BOOTSTRAP_EMAIL in your .env first.');
    process.exit(1);
  }

  const userRecord = await auth.getUserByEmail(email).catch(() => null);
  if (!userRecord) {
    console.error(`No Firebase Auth user found for ${email}. Register on the site first.`);
    process.exit(1);
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: 'owner' });

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(userRecord.uid).set(
    { role: 'owner', status: 'active', email, updatedAt: now },
    { merge: true }
  );
  await db.collection('moderatorProfiles').doc(userRecord.uid).set(
    {
      name: 'المالك',
      staffId: 'OWNER',
      avatar: null,
      bio: 'مالك المنصة',
      role: 'owner',
      joinedAt: now,
      status: 'active',
      stats: { added: 0, reviewed: 0 },
    },
    { merge: true }
  );

  console.log(`✅ ${email} (uid: ${userRecord.uid}) is now Owner. Sign out and back in on the site to refresh the session.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to set owner:', err);
  process.exit(1);
});
