'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { validateFlow } = require('./registry');
const { executeFlow } = require('./executor');
const logger = require('../utils/logger');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

class FlowEngine extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, object>} */
    this._flows = new Map();
  }

  /**
   * Register a flow definition after validation.
   * @param {object} flow
   * @throws {Error} if the flow is invalid
   */
  register(flow) {
    validateFlow(flow);
    if (this._flows.has(flow.name)) {
      logger.warn('Flow already registered — overwriting', { flow: flow.name });
    }
    this._flows.set(flow.name, flow);
    logger.info('Flow registered', { flow: flow.name, version: flow.version, steps: flow.steps.length });
  }

  /**
   * Auto-load all JSON files from the templates directory and register them.
   */
  loadTemplates() {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      logger.warn('Templates directory not found', { path: TEMPLATES_DIR });
      return;
    }

    const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'));

    if (files.length === 0) {
      logger.warn('No flow templates found', { path: TEMPLATES_DIR });
      return;
    }

    for (const file of files) {
      const filePath = path.join(TEMPLATES_DIR, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const flow = JSON.parse(raw);
        this.register(flow);
      } catch (err) {
        logger.error('Failed to load flow template', { file, error: err.message });
      }
    }
  }

  /**
   * Execute a registered flow by name.
   * @param {string} name
   * @param {object} payload
   * @returns {Promise<object>} Execution result
   */
  async run(name, payload = {}) {
    const flow = this._flows.get(name);
    if (!flow) {
      throw new Error(`Flow '${name}' is not registered`);
    }
    logger.info('Running flow', { flow: name });
    return executeFlow(flow, payload, this);
  }

  /**
   * Get a flow definition by name.
   * @param {string} name
   * @returns {object|undefined}
   */
  get(name) {
    return this._flows.get(name);
  }

  /**
   * List all registered flows with metadata.
   * @returns {object[]}
   */
  list() {
    return Array.from(this._flows.values()).map((f) => ({
      name: f.name,
      version: f.version,
      description: f.description || '',
      stepCount: f.steps.length,
      triggers: f.triggers || [],
    }));
  }
}

// Singleton instance shared across the application
const engine = new FlowEngine();

module.exports = engine;
