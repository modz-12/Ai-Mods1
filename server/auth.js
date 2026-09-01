'use strict';

const { auth, db } = require('./firebase-admin');

/**
 * ROLE MODEL
 * ----------
 * Roles are never trusted from the client. A role lives in two places:
 *   1. Firebase custom claims (fast, embedded in the ID token)
 *   2. users/{uid}.role in Firestore (source of truth, used by rules too)
 *
 * When an Owner promotes/demotes a moderator (server/routes/moderators.js)
 * we update BOTH atomically. This middleware re-checks Firestore on every
 * request rather than trusting a possibly-stale token claim, so a demotion
 * takes effect immediately instead of waiting for token refresh.
 */

const ROLE_RANK = { user: 0, moderator: 1, owner: 2 };

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const decoded = await auth.verifyIdToken(match[1], true);
    const userSnap = await db.collection('users').doc(decoded.uid).get();

    if (!userSnap.exists) {
      // First time we see this uid: create a base "user" record and a
      // matching simple profile document (spec 8, 33: profiles/{uid}).
      const base = {
        uid: decoded.uid,
        email: decoded.email || null,
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection('users').doc(decoded.uid).set(base);
      await db.collection('profiles').doc(decoded.uid).set({
        displayName: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'مستخدم'),
        bio: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      req.user = base;
    } else {
      req.user = userSnap.data();
    }

    if (req.user.status === 'disabled') {
      return res.status(403).json({ error: 'This account has been disabled.' });
    }

    req.user.uid = decoded.uid;
    next();
  } catch (err) {
    console.error('[auth] token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

function requireRole(minRole) {
  const minRank = ROLE_RANK[minRole];
  if (minRank === undefined) throw new Error(`Unknown role in requireRole: ${minRole}`);

  return (req, res, next) => {
    const rank = ROLE_RANK[req.user?.role] ?? 0;
    if (rank < minRank) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, ROLE_RANK };
