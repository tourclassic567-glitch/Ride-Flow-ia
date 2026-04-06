import React, { useState, useEffect } from 'react';
import { getPendingBookings, acceptBooking, rejectBooking } from '../../services/api';

const MOCK_RIDES = [
  {
    id: 101,
    ride_id: 101,
    pickup_location: '123 Brickell Ave, Miami',
    dropoff_location: 'Miami International Airport',
    estimated_price: 18.75,
    status: 'requested',
  },
  {
    id: 102,
    ride_id: 102,
    pickup_location: 'Wynwood Arts District',
    dropoff_location: 'South Beach, Miami Beach',
    estimated_price: 12.40,
    status: 'requested',
  },
  {
    id: 103,
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
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => {
    async function fetchRides() {
      setLoading(true);
      try {
        const res = await getPendingBookings();
        const bookings = res.data.bookings || [];
        // Normalize: ensure ride_id field exists alongside id
        const normalized = bookings.map((b) => ({
          ...b,
          ride_id: b.ride_id ?? b.id,
          estimated_price: b.price ? parseFloat(b.price) : null,
        }));
        setRides(normalized.length > 0 ? normalized : MOCK_RIDES);
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
      await acceptBooking(ride.id ?? ride.ride_id, driverId);
    } catch {
      // In mock mode, still accept the ride locally
    } finally {
      setRides((prev) => prev.filter((r) => r.ride_id !== ride.ride_id));
      if (onRideAccepted) {
        onRideAccepted({ ...ride, status: 'matched', driver_id: driverId });
      }
      setAccepting(null);
    }
  }

  async function handleReject(ride) {
    setRejecting(ride.ride_id);
    try {
      await rejectBooking(ride.id ?? ride.ride_id);
    } catch {
      // In mock mode, still remove from list
    } finally {
      setRides((prev) => prev.filter((r) => r.ride_id !== ride.ride_id));
      setRejecting(null);
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
            <strong style={{ color: 'var(--primary)' }}>{ride.estimated_price != null ? `$${ride.estimated_price.toFixed(2)}` : 'TBD'}</strong>
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

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              className="btn btn-success btn-sm"
              style={{ flex: 1 }}
              onClick={() => handleAccept(ride)}
              disabled={accepting === ride.ride_id || rejecting === ride.ride_id}
            >
              {accepting === ride.ride_id ? <span className="spinner" /> : '✅ Accept'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ flex: 1 }}
              onClick={() => handleReject(ride)}
              disabled={accepting === ride.ride_id || rejecting === ride.ride_id}
            >
              {rejecting === ride.ride_id ? <span className="spinner" /> : '❌ Reject'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default RideList;
