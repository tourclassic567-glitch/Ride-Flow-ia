const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

let rides = [];

// Endpoint for ride matching
app.post('/match-ride', (req, res) => {
    const { startLocation, endLocation } = req.body;
    // Logic for matching a ride
    // For demo, we just return an empty response
    res.json({ message: 'Ride matching logic here' });
});

// Endpoint for pricing
app.post('/get-price', (req, res) => {
    const { rideId } = req.body;
    // Logic for determining pricing
    // For demo, we just return a fixed price
    res.json({ rideId, price: 10.00 });
});

// WebSocket for real-time ride tracking
wss.on('connection', (ws) => {
    console.log('New connection established');

    ws.on('message', (message) => {
        console.log('Received:', message);
        // Handle incoming messages from client
    });

    // Send tracking updates every second
    const interval = setInterval(() => {
        ws.send(JSON.stringify({ message: 'Tracking update' }));
    }, 1000);

    ws.on('close', () => {
        clearInterval(interval);
        console.log('Connection closed');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});