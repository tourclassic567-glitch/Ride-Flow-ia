// bookingAPI.js

const API_BASE_URL = 'https://api.example.com/bookings';

// Create a booking
export const createBooking = async (bookingData) => {
    const response = await fetch(`${API_BASE_URL}/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
    });
    return response.json();
};

// Accept a booking
export const acceptBooking = async (bookingId) => {
    const response = await fetch(`${API_BASE_URL}/accept/${bookingId}`, {
        method: 'POST',
    });
    return response.json();
};

// Reject a booking
export const rejectBooking = async (bookingId) => {
    const response = await fetch(`${API_BASE_URL}/reject/${bookingId}`, {
        method: 'POST',
    });
    return response.json();
};

// Fetch all bookings
export const fetchBookings = async () => {
    const response = await fetch(`${API_BASE_URL}/list`, {
        method: 'GET',
    });
    return response.json();
};

export default { createBooking, acceptBooking, rejectBooking, fetchBookings };