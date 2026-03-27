'use strict';

const EventTypes = {
  // Ride lifecycle
  RIDE_REQUESTED: 'ride.requested',
  RIDE_CREATED: 'ride.created',
  RIDE_MATCHED: 'ride.matched',
  RIDE_STARTED: 'ride.started',
  RIDE_COMPLETED: 'ride.completed',
  RIDE_CANCELLED: 'ride.cancelled',

  // Driver events
  DRIVER_LOCATION_UPDATED: 'driver.location.updated',
  DRIVER_STATUS_CHANGED: 'driver.status.changed',
  DRIVER_ASSIGNED: 'driver.assigned',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_RIDE_REQUEST: 'user.ride.request',

  // System events
  FLOW_STARTED: 'flow.started',
  FLOW_COMPLETED: 'flow.completed',
  FLOW_FAILED: 'flow.failed',
  STEP_COMPLETED: 'step.completed',
  STEP_FAILED: 'step.failed',
};

const ALL_EVENT_TYPES = new Set(Object.values(EventTypes));

function isValidEvent(event) {
  return ALL_EVENT_TYPES.has(event);
}

module.exports = { EventTypes, ALL_EVENT_TYPES, isValidEvent };
