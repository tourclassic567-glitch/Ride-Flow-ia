const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const healthCheck = require('health-check');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Health Check Endpoint
app.get('/health', healthCheck);

// Example endpoint
app.get('/api/example', (req, res) => {
    res.json({ message: 'This is an example endpoint.' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Graceful Shutdown
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

// Railway Compatibility
if (typeof process.env.railway !== 'undefined') {
    console.log('Running on Railway.');
}