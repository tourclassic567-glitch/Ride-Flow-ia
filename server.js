const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let bookings = {};
let currentBookingId = 1;

app.use(express.json());

// Endpoint for creating a new booking
app.post('/bookings', (req, res) => {
    const { passenger_id, driver_id, pickup_location, dropoff_location, scheduled_time } = req.body;
    const booking_id = currentBookingId++;
    bookings[booking_id] = {
        booking_id,
        passenger_id,
        driver_id,
        pickup_location,
        dropoff_location,
        scheduled_time,
        status: 'pending'
    };

    // Broadcast the new booking state
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'booking_created', booking: bookings[booking_id] }));
        }
    });

    res.status(201).json(bookings[booking_id]);
});

// Endpoint for accepting a booking
app.put('/bookings/:id/accept', (req, res) => {
    const booking_id = req.params.id;
    if (bookings[booking_id]) {
        bookings[booking_id].status = 'confirmed';
        // Broadcast booking state change
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'booking_status_changed', booking: bookings[booking_id] }));
            }
        });
        res.json(bookings[booking_id]);
    } else {
        res.status(404).send('Booking not found');
    }
});

// Endpoint for completing a booking
app.put('/bookings/:id/complete', (req, res) => {
    const booking_id = req.params.id;
    if (bookings[booking_id]) {
        bookings[booking_id].status = 'completed';
        // Broadcast booking state change
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'booking_status_changed', booking: bookings[booking_id] }));
            }
        });
        res.json(bookings[booking_id]);
    } else {
        res.status(404).send('Booking not found');
    }
});

// WebSocket connection
wss.on('connection', (ws) => {
    console.log('A client connected');
    ws.on('close', () => {
        console.log('A client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});