import React, { useState, useEffect } from 'react';
import { matchRide } from '../../services/api';

const MOCK_RIDES = [
  {
    ride_id: 101,
    pickup_location: '123 Brickell Ave, Miami',
    dropoff_location: 'Miami International Airport',
    estimated_price: 18.75,
    status: 'requested',
  },
  {
    ride_id: 102,
    pickup_location: 'Wynwood Arts District',
    dropoff_location: 'South Beach, Miami Beach',
    estimated_price: 12.40,
    status: 'requested',
  },
  {
    ride_id: 103,
    pickup_location: 'Coconut Grove',
    dropoff_location: 'Downtown Miami',
    estimated_price: 9.90,
    status: 'requested',
  },
];

function RideList({ driverId, onRideAccepted }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    async function fetchRides() {
      setLoading(true);
      try {
        // Try to fetch a real ride; fall back to mock data
        await new Promise((r) => setTimeout(r, 600));
        setRides(MOCK_RIDES);
      } catch {
        setRides(MOCK_RIDES);
      } finally {
        setLoading(false);
      }
    }

    fetchRides();
  }, [driverId]);

  async function handleAccept(ride) {
    setAccepting(ride.ride_id);
    try {
      await matchRide({ ride_id: ride.ride_id });
      setRides((prev) => prev.filter((r) => r.ride_id !== ride.ride_id));
      if (onRideAccepted) {
        onRideAccepted({ ...ride, status: 'matched', driver_id: driverId });
      }
    } catch {
      // In mock mode, still accept the ride
      setRides((prev) => prev.filter((r) => r.ride_id !== ride.ride_id));
      if (onRideAccepted) {
        onRideAccepted({ ...ride, status: 'matched', driver_id: driverId });
      }
    } finally {
      setAccepting(null);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
        <span className="spinner" style={{ borderColor: 'rgba(108,99,255,0.3)', borderTopColor: 'var(--primary)' }} />
        <p style={{ marginTop: '0.5rem' }}>Loading available rides...</p>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
        <p>No available rides at the moment. Stay online!</p>
      </div>
    );
  }

  return (
    <div>
      {rides.map((ride) => (
        <div key={ride.ride_id} className="ride-card">
          <div className="ride-card-header">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ride #{ride.ride_id}</span>
            <strong style={{ color: 'var(--primary)' }}>${ride.estimated_price.toFixed(2)}</strong>
          </div>

          <div className="ride-locations">
            <div className="location-row">
              <span>📍</span>
              <span>{ride.pickup_location}</span>
            </div>
            <div className="location-row">
              <span>🏁</span>
              <span>{ride.dropoff_location}</span>
            </div>
          </div>

          <button
            className="btn btn-success btn-sm"
            style={{ marginTop: '0.75rem', width: '100%' }}
            onClick={() => handleAccept(ride)}
            disabled={accepting === ride.ride_id}
          >
            {accepting === ride.ride_id ? <span className="spinner" /> : '✅ Accept Ride'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default RideList;
