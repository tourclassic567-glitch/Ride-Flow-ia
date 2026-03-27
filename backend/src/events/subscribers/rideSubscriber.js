'use strict';

/**
 * Ride subscriber – reacts to ride-lifecycle events on the eventBus
 * and triggers the appropriate services.
 *
 * Responsibilities:
 *   DRIVER_MATCH_REQUESTED → call matching service → emit DRIVER_ASSIGNED
 *   RIDE_REQUESTED         → hook for side-effects (logging, notifications, etc.)
 */

const eventBus = require('../eventBus');
const eventTypes = require('../eventTypes');
const { findNearestDriver } = require('../../services/matching');

function register() {
  eventBus.subscribe(eventTypes.RIDE_REQUESTED, handleRideRequested);
  eventBus.subscribe(eventTypes.DRIVER_MATCH_REQUESTED, handleDriverMatchRequested);
  console.log('[rideSubscriber] Registered for RIDE_REQUESTED, DRIVER_MATCH_REQUESTED');
}

/**
 * Reacts to a new ride being placed.
 * Use this hook for side-effects: push notifications, logging, analytics, etc.
 */
async function handleRideRequested(payload) {
  try {
    console.log('[rideSubscriber] RIDE_REQUESTED – ride_id:', payload.ride_id || payload.ride?.id);
  } catch (err) {
    console.error('[rideSubscriber] handleRideRequested error:', err.message);
  }
}

/**
 * Reacts to a driver-match being requested.
 * Calls the matching service (the ONLY place where matchDriver is invoked)
 * and emits DRIVER_ASSIGNED with the result.
 */
async function handleDriverMatchRequested(payload) {
  try {
    const driver = await findNearestDriver(payload.ride_id);

    eventBus.publish(eventTypes.DRIVER_ASSIGNED, {
      ride_id: payload.ride_id,
      driver_id: driver.id,
      driver,
      status: 'matched',
      estimated_arrival: '5 minutes',
    });
  } catch (err) {
    console.error('[rideSubscriber] handleDriverMatchRequested error:', err.message);
    // Re-publish as FLOW_FAILED so orchestrator / observers can react
    eventBus.publish(eventTypes.FLOW_FAILED, {
      source: 'rideSubscriber.handleDriverMatchRequested',
      error: err.message,
      payload,
    });
  }
}

module.exports = { register };
