import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const login = (data) => api.post('/auth/login', data);
export const requestRide = (data) => api.post('/ride/request', data);
export const matchRide = (data) => api.post('/ride/match', data);
export const getRide = (id) => api.get(`/ride/${id}`);
export const calculatePricing = (data) => api.post('/pricing/calculate', data);
export const createPayment = (data) => api.post('/ride/pay', data);
export const confirmPayment = (data) => api.post('/ride/pay/confirm', data);

// Bookings
export const getPendingBookings = () => api.get('/bookings/pending');
export const createBooking = (data) => api.post('/bookings', data);
export const acceptBooking = (id, driverId) => api.put(`/bookings/${id}/accept`, { driver_id: driverId });
export const rejectBooking = (id) => api.put(`/bookings/${id}/reject`);

export default api;
