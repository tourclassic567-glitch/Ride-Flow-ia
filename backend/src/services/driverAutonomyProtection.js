// DriverAutonomyProtection.js

class DriverAutonomyProtection {
    constructor() {
        this.rejectionsWithoutPenalty = [];
        this.laborProtectionRegister = [];
    }
    
    // Allow rejections without penalty
    allowRejection(driverId) {
        this.rejectionsWithoutPenalty.push(driverId);
        console.log(`Driver ${driverId} allowed a rejection without penalty.`);
    }
    
    // Register labor protection for a driver
    registerLaborProtection(driverId, protectionDetails) {
        this.laborProtectionRegister.push({ driverId, ...protectionDetails });
        console.log(`Labor protection registered for driver ${driverId}.`);
    }
    
    // Verify no penalties for a driver
    verifyNoPenalties(driverId) {
        const hasProtection = this.rejectionsWithoutPenalty.includes(driverId) || this.laborProtectionRegister.some(protection => protection.driverId === driverId);
        return !hasProtection;
    }
}

module.exports = DriverAutonomyProtection;