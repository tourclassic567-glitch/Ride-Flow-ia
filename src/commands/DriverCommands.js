// DriverCommands.js

// Core Commands for Driver Autonomy Protection

class DriverCommands {
    constructor() {
        this._autonomyActive = false;
        this._speedLimit = null;
        this._driverStatus = 'idle';
        this._events = [];
        this._driveParameters = {};
        this._emergencyStopped = false;
    }

    activateAutonomy() {
        this._autonomyActive = true;
        this._driverStatus = 'autonomous';
        this._logEvent('autonomy_activated');
    }

    deactivateAutonomy() {
        this._autonomyActive = false;
        this._driverStatus = 'manual';
        this._logEvent('autonomy_deactivated');
    }

    setSpeedLimit(limit) {
        if (typeof limit !== 'number' || limit < 0) {
            throw new Error('Speed limit must be a non-negative number');
        }
        this._speedLimit = limit;
        this._logEvent(`speed_limit_set:${limit}`);
    }

    monitorDriverStatus() {
        return {
            status: this._driverStatus,
            autonomyActive: this._autonomyActive,
            speedLimit: this._speedLimit,
            emergencyStopped: this._emergencyStopped,
        };
    }

    alertDriver() {
        const alert = { type: 'emergency', timestamp: new Date().toISOString(), message: 'Emergency alert issued to driver' };
        this._logEvent('driver_alerted');
        console.warn('[DriverCommands] ALERT:', alert.message);
        return alert;
    }

    logAutonomyEvents() {
        return [...this._events];
    }

    updateDriveParameters(params) {
        if (params && typeof params === 'object') {
            this._driveParameters = { ...this._driveParameters, ...params };
            this._logEvent('drive_parameters_updated');
        }
    }

    isAutonomyActive() {
        return this._autonomyActive;
    }

    overrideAutonomy() {
        this._autonomyActive = false;
        this._driverStatus = 'override';
        this._logEvent('autonomy_overridden');
    }

    resetDriverCommands() {
        this._logEvent('commands_reset');
        this._autonomyActive = false;
        this._speedLimit = null;
        this._driverStatus = 'idle';
        this._events = [];
        this._driveParameters = {};
        this._emergencyStopped = false;
    }

    emergencyStop() {
        this._emergencyStopped = true;
        this._autonomyActive = false;
        this._driverStatus = 'stopped';
        this._speedLimit = 0;
        this._logEvent('emergency_stop');
        this.alertDriver();
        console.warn('[DriverCommands] EMERGENCY STOP activated. All operations halted.');
    }

    _logEvent(event) {
        this._events.push({ event, timestamp: new Date().toISOString() });
    }
}

module.exports = DriverCommands;