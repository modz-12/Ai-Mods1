'use strict';

const fs = require('fs');
const admin = require('firebase-admin');

/**
 * Initializes the Firebase Admin SDK exactly once.
 * Accepts either:
 *  - FIREBASE_SERVICE_ACCOUNT_JSON  (inline JSON string), or
 *  - FIREBASE_SERVICE_ACCOUNT_PATH  (path to a JSON key file)
 *
 * This module is the ONLY place server-side Firebase credentials are
 * loaded. Nothing here is ever sent to the frontend.
 */
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON: ' + err.message
      );
    }
  }

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Firebase service account not found at "${keyPath}". ` +
      'Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in your .env. ' +
      'See docs/SETUP.md for how to generate this key in Firebase Console.'
    );
  }
  return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    storageBucket: `${process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id}.appspot.com`,
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

// Firestore settings: ignore undefined values instead of throwing,
// since optional fields (e.g. subdomain: "") are common in this schema.
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth, storage };
