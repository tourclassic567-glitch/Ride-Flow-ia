class BookingWebSocketHandler {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.bookings = {};
        this.init();
    }

    init() {
        this.wss.on('connection', (ws) => {
            ws.on('message', (message) => this.handleMessage(ws, message));
            this.sendExistingBookings(ws);
        });
    }

    handleMessage(ws, message) {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'new_booking':
                this.addBooking(data.booking);
                break;
            case 'reject_booking':
                this.rejectBooking(data.bookingId);
                break;
            // Add more handlers as needed
        }
    }

    addBooking(booking) {
        this.bookings[booking.id] = booking;
        this.broadcast({ type: 'booking_update', booking });
    }

    rejectBooking(bookingId) {
        if (this.bookings[bookingId]) {
            this.broadcast({ type: 'booking_reject', bookingId });
            delete this.bookings[bookingId];
        }
    }

    broadcast(data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    sendExistingBookings(ws) {
        ws.send(JSON.stringify({ type: 'existing_bookings', bookings: this.bookings }));
    }
}

module.exports = BookingWebSocketHandler;