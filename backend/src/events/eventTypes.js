'use strict';

/**
 * Central registry of all event type constants used by the eventBus.
 * Every event emitted in the system must be declared here.
 */
module.exports = Object.freeze({
  // Ride lifecycle
  RIDE_REQUESTED: 'RIDE_REQUESTED',
  DRIVER_MATCH_REQUESTED: 'DRIVER_MATCH_REQUESTED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',

  // Payment lifecycle
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',

  // Flow control / observability
  FLOW_RETRY: 'FLOW_RETRY',
  FLOW_FAILED: 'FLOW_FAILED',
});
