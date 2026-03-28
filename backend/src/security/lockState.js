'use strict';

/**
 * Lock State – system-wide execution gate.
 *
 * When locked, the flow executor refuses to run any flow and returns a
 * LOCKED error to the caller. The lock can be toggled at runtime via the
 * EXECUTE:LOCK / EXECUTE:UNLOCK commands exposed by /api/command.
 *
 * Initial state is controlled by the FORCE_LOCK environment variable:
 *   FORCE_LOCK=true  → server starts in the locked state
 *   (absent / false) → server starts unlocked (default)
 */

let _locked = process.env.FORCE_LOCK === 'true';

/** @returns {boolean} true when the system is currently locked */
function isLocked() {
  return _locked;
}

/** Engage the lock – all subsequent flow executions will be rejected. */
function lock() {
  _locked = true;
}

/** Release the lock – flow executions are permitted again. */
function unlock() {
  _locked = false;
}

module.exports = { isLocked, lock, unlock };
