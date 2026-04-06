class BookingService {
    constructor() {
        this.bookings = [];
    }

    addBooking(booking) {
        // Ensure the booking complies with driver autonomy protections
        if (!this.isDriverAvailable(booking.driverId)) {
            throw new Error('Driver is not available for this booking.');
        }
        
        this.bookings.push(booking);
        return booking;
    }

    isDriverAvailable(driverId) {
        // Logic to check if the driver can accept more bookings
        // For simplicity, let's assume each driver can only handle 3 bookings
        const driverBookings = this.bookings.filter(b => b.driverId === driverId);
        return driverBookings.length < 3;
    }

    getBookings() {
        return this.bookings;
    }
}

// Export the class for usage
module.exports = BookingService;
