'use strict';

/**
 * API Key Store
 *
 * Keys are loaded from environment variables for production deployments.
 * Each entry has:
 *   keyId  {string}  – public identifier sent in the x-api-key header
 *   secret {string}  – private HMAC secret; never exposed in responses
 *   active {boolean} – inactive keys are rejected immediately
 *
 * Environment variable format (can define up to 10 keys):
 *   API_KEY_1_ID=<id>  API_KEY_1_SECRET=<secret>  API_KEY_1_ACTIVE=true
 *   API_KEY_2_ID=<id>  API_KEY_2_SECRET=<secret>  API_KEY_2_ACTIVE=true
 *   ...
 *
 * A built-in development key is always present when NODE_ENV !== 'production'
 * so the stack works out-of-the-box without any configuration.
 */

const MAX_KEYS = 10;

function loadKeysFromEnv() {
  const keys = [];
  for (let i = 1; i <= MAX_KEYS; i++) {
    const id = process.env[`API_KEY_${i}_ID`];
    const secret = process.env[`API_KEY_${i}_SECRET`];
    if (id && secret) {
      const activeRaw = process.env[`API_KEY_${i}_ACTIVE`];
      keys.push({
        keyId: id,
        secret,
        active: activeRaw === undefined ? true : activeRaw === 'true',
      });
    }
  }
  return keys;
}

const _store = new Map();

function _seed() {
  // Load environment-configured keys first
  for (const k of loadKeysFromEnv()) {
    _store.set(k.keyId, k);
  }

  // Built-in dev key – never available in production
  if (process.env.NODE_ENV !== 'production' && !_store.has('dev-key-001')) {
    _store.set('dev-key-001', {
      keyId: 'dev-key-001',
      secret: 'dev-secret-do-not-use-in-production',
      active: true,
    });
  }
}

_seed();

/**
 * Look up an API key by its public keyId.
 *
 * @param {string} keyId
 * @returns {{ keyId: string, secret: string, active: boolean } | undefined}
 */
function getKey(keyId) {
  return _store.get(keyId);
}

module.exports = { getKey };
