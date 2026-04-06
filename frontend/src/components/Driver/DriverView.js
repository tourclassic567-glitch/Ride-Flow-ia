import React, { useState, useEffect, useCallback } from 'react';
import RideList from './RideList';
import { connect, subscribe, unsubscribe } from '../../services/websocket';
import { rejectBooking } from '../../services/api';

function DriverView({ user }) {
  const [isOnline, setIsOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [earnings, setEarnings] = useState(0);

  const handleRideMatched = useCallback((message) => {
    setCurrentRide({
      id: message.ride_id,
      ride_id: message.ride_id,
      driver_id: message.driver_id,
      status: 'matched',
    });
  }, []);

  useEffect(() => {
    try {
      connect();
    } catch {
      // WebSocket not available without backend
    }

    subscribe('RIDE_MATCHED', handleRideMatched);
    return () => unsubscribe('RIDE_MATCHED', handleRideMatched);
  }, [handleRideMatched]);

  function handleCompleteRide() {
    const fare = parseFloat(currentRide?.estimated_price || currentRide?.price || 10);
    setEarnings((prev) => prev + fare);
    setCurrentRide(null);
  }

  async function handleCancelRide() {
    try {
      await rejectBooking(currentRide.id ?? currentRide.ride_id);
    } catch {
      // Non-fatal if backend unavailable
    }
    setCurrentRide(null);
  }

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2 className="card-title">🚗 Driver Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Welcome, {user ? user.email.split('@')[0] : 'Driver'}
        </p>

        <div className="earnings-display">
          <div>
            <div className="earnings-label">Today's Earnings</div>
            <div className="earnings-amount">${earnings.toFixed(2)}</div>
          </div>
          <span style={{ fontSize: '2rem' }}>💰</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>Status: </strong>
            <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            className={`btn ${isOnline ? 'btn-danger' : 'btn-success'}`}
            onClick={() => {
              setIsOnline((prev) => !prev);
              if (isOnline) setCurrentRide(null);
            }}
          >
            {isOnline ? '🔴 Go Offline' : '🟢 Go Online'}
          </button>
        </div>
      </div>

      {currentRide && (
        <div className="card">
          <h3 className="card-title">🚦 Active Ride</h3>
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            You've been matched to ride <strong>#{currentRide.ride_id}</strong>
          </div>
          <div className="ride-locations">
            <div className="location-row">
              <span>📍</span>
              <span>Pickup: <strong>{currentRide.pickup_location || 'Assigned location'}</strong></span>
            </div>
            <div className="location-row">
              <span>🏁</span>
              <span>Drop-off: <strong>{currentRide.dropoff_location || 'Destination'}</strong></span>
            </div>
          </div>
          {currentRide.estimated_price && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fare</span>
              <strong style={{ color: 'var(--primary)' }}>${parseFloat(currentRide.estimated_price).toFixed(2)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-success btn-lg"
              style={{ flex: 1 }}
              onClick={handleCompleteRide}
            >
              ✅ Complete Ride
            </button>
            <button
              className="btn btn-danger btn-lg"
              style={{ flex: 1 }}
              onClick={handleCancelRide}
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {isOnline && !currentRide && (
        <div className="card">
          <h3 className="card-title">📋 Available Rides</h3>
          <RideList driverId={user ? user.id : 1} onRideAccepted={setCurrentRide} />
        </div>
      )}

      {!isOnline && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>😴</div>
          <p style={{ color: 'var(--text-muted)' }}>You're offline. Go online to start receiving ride requests.</p>
        </div>
      )}
    </div>
  );
}

export default DriverView;
