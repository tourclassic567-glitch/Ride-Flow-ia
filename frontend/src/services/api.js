import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const requestRide = (data) => api.post('/ride/request', data);
export const matchRide = (data) => api.post('/ride/match', data);
export const getRide = (id) => api.get(`/ride/${id}`);
export const calculatePricing = (data) => api.post('/pricing/calculate', data);

export default api;
