'use strict';

const rideService = require('./rides');
const matchingService = require('./matching');
const stripeService = require('./stripeService');
const websocketService = require('./websocket');

/**
 * Central service registry — explicit mapping only, no dynamic require().
 * Add new services here as the platform grows.
 */
const SERVICE_MAP = {
  rides: rideService,
  matching: matchingService,
  payments: stripeService,
  websocket: websocketService,
};

/**
 * Resolve a service by name.
 * @param {string} name - Service name (e.g. 'rides', 'payments')
 * @returns {object} Service instance
 * @throws {Error} If the service is not registered
 */
function resolve(name) {
  if (!Object.prototype.hasOwnProperty.call(SERVICE_MAP, name)) {
    throw new Error(`Service '${name}' is not registered in the service registry`);
  }
  return SERVICE_MAP[name];
}

/**
 * Check whether a service is registered.
 * @param {string} name
 * @returns {boolean}
 */
function has(name) {
  return Object.prototype.hasOwnProperty.call(SERVICE_MAP, name);
}

/**
 * Return the list of registered service names.
 * @returns {string[]}
 */
function list() {
  return Object.keys(SERVICE_MAP);
}

module.exports = { resolve, has, list };
