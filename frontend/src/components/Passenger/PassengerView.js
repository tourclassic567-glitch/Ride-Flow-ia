import React, { useState, useEffect, useCallback } from 'react';
import RideRequest from './RideRequest';
import { connect, subscribe, unsubscribe } from '../../services/websocket';

function PassengerView({ user }) {
  const [currentRide, setCurrentRide] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);

  const handleRideCreated = useCallback((ride) => {
    setCurrentRide(ride);
    setRideStatus(ride.status);
  }, []);

  useEffect(() => {
    try {
      connect();
    } catch {
      // WebSocket not available in dev without backend
    }

    function onRideMatched(message) {
      if (currentRide && message.ride_id === currentRide.ride_id) {
        setRideStatus('matched');
        setCurrentRide((prev) => ({
          ...prev,
          status: 'matched',
          driver_id: message.driver_id,
        }));
      }
    }

    subscribe('RIDE_MATCHED', onRideMatched);
    return () => unsubscribe('RIDE_MATCHED', onRideMatched);
  }, [currentRide]);

  const statusColors = {
    requested: 'badge-requested',
    matched: 'badge-matched',
    in_progress: 'badge-in_progress',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled',
  };

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2 className="card-title">👋 Welcome, {user ? user.email.split('@')[0] : 'Passenger'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Request a ride and we'll match you with the nearest driver using AI.
        </p>
      </div>

      <RideRequest user={user} onRideCreated={handleRideCreated} />

      {currentRide && (
        <div className="card">
          <h3 className="card-title">🚦 Current Ride</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span>Status</span>
            <span className={`badge ${statusColors[rideStatus] || 'badge-requested'}`}>
              {rideStatus}
            </span>
          </div>

          <div className="ride-locations">
            <div className="location-row">
              <span>📍</span>
              <span><strong>From:</strong> {currentRide.pickup_location}</span>
            </div>
            <div className="location-row">
              <span>🏁</span>
              <span><strong>To:</strong> {currentRide.dropoff_location}</span>
            </div>
          </div>

          <hr className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Ride ID</span>
            <strong>#{currentRide.ride_id}</strong>
          </div>

          {currentRide.estimated_price && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estimated Price</span>
              <strong style={{ color: 'var(--primary)' }}>${currentRide.estimated_price.toFixed(2)}</strong>
            </div>
          )}

          {currentRide.driver_id && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Driver ID</span>
              <strong>#{currentRide.driver_id}</strong>
            </div>
          )}

          {rideStatus === 'matched' && (
            <div className="alert alert-success" style={{ marginTop: '1rem', marginBottom: 0 }}>
              🎉 Driver found! Estimated arrival: <strong>5 minutes</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PassengerView;
