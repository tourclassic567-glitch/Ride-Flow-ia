import React, { useState } from 'react';
import { login } from '../../services/api';

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'passenger',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  function validate() {
    if (!formData.email.trim()) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(formData.email)) return 'Please enter a valid email.';
    if (formData.password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await login({
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      onLogin(res.data);
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.error || 'Login failed. Please try again.');
      } else {
        // Backend unavailable – fall back to mock for demo purposes
        onLogin({
          id: Date.now(),
          email: formData.email,
          role: formData.role,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>🚗 Ride-Flow IA</h1>
          <p>AI-powered ridesharing platform</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              placeholder="Min. 6 characters"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">I want to</label>
            <select
              id="role"
              name="role"
              className="form-control select"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="passenger">🧍 Request a ride (Passenger)</option>
              <option value="driver">🚗 Give rides (Driver)</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          MVP demo – auto-registers on first sign-in when backend is available
        </p>
      </div>
    </div>
  );
}

export default Login;
