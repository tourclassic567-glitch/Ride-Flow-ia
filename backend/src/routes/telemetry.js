'use strict';

/**
 * GET /api/telemetry
 *
 * Returns the current in-memory telemetry snapshot:
 *   - events tracked (total, errors, recent 10)
 *   - commands tracked (total, errors, recent 10)
 *   - error log (total, recent 10)
 *
 * This endpoint is public (no HMAC required) so monitoring systems
 * can poll it without credentials, analogous to /api/radar.
 */

const express = require('express');
const router = express.Router();
const telemetry = require('../observability/telemetry');

router.get('/', (_req, res) => {
  res.json(telemetry.getStats());
});

module.exports = router;
