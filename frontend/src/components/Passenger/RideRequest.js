import React, { useState } from 'react';
import { calculatePricing, requestRide, matchRide } from '../../services/api';

const STEPS = ['idle', 'pricing', 'requesting', 'matching', 'done'];

function RideRequest({ user, onRideCreated }) {
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [pricingData, setPricingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('idle');
  const [rideResult, setRideResult] = useState(null);

  async function handleGetPrice() {
    if (!pickupLocation.trim() || !dropoffLocation.trim()) {
      setError('Please fill in both pickup and dropoff locations.');
      return;
    }
    setError('');
    setLoading(true);
    setStep('pricing');

    try {
      const res = await calculatePricing({
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
      });
      setEstimatedPrice(res.data.estimated_price);
      setPricingData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate price. Is the backend running?');
      setStep('idle');
    } finally {
      setLoading(false);
      if (step === 'pricing') setStep('idle');
    }
  }

  async function handleRequestRide() {
    if (!pickupLocation.trim() || !dropoffLocation.trim()) {
      setError('Please fill in both locations.');
      return;
    }
    setError('');

    try {
      // Step 1 – Request ride
      setStep('requesting');
      setLoading(true);
      const rideRes = await requestRide({
        passenger_id: user ? user.id : 1,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
      });
      const ride = rideRes.data;

      // Step 2 – Match driver
      setStep('matching');
      const matchRes = await matchRide({ ride_id: ride.ride_id });
      const match = matchRes.data;

      // Done
      setStep('done');
      const fullRide = { ...ride, ...match };
      setRideResult(fullRide);
      if (onRideCreated) onRideCreated(fullRide);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request ride. Is the backend running?');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPickupLocation('');
    setDropoffLocation('');
    setEstimatedPrice(null);
    setPricingData(null);
    setError('');
    setStep('idle');
    setRideResult(null);
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="card">
      <h3 className="card-title">🗺️ Request a Ride</h3>

      {error && <div className="alert alert-error">{error}</div>}

      {step !== 'done' ? (
        <>
          <div className="form-group">
            <label htmlFor="pickup">Pickup Location</label>
            <input
              id="pickup"
              className="form-control"
              placeholder="e.g. 123 Main St, Miami"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="dropoff">Drop-off Location</label>
            <input
              id="dropoff"
              className="form-control"
              placeholder="e.g. Miami International Airport"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              disabled={loading}
            />
          </div>

          {estimatedPrice && pricingData && (
            <div className="price-box">
              <div className="price-amount">${estimatedPrice.toFixed(2)}</div>
              <div className="price-label">Estimated fare · {pricingData.breakdown.distance_estimate} miles</div>
              {pricingData.surge_active && (
                <span className="surge-badge">⚡ Surge ×{pricingData.breakdown.surge_multiplier}</span>
              )}
            </div>
          )}

          {step !== 'idle' && (
            <div className="steps">
              <div className={`step ${stepIndex >= 1 ? (stepIndex > 1 ? 'done' : 'active') : ''}`}>
                <div className="step-icon">{stepIndex > 1 ? '✓' : '1'}</div>
                Calculating price...
              </div>
              <div className={`step ${stepIndex >= 2 ? (stepIndex > 2 ? 'done' : 'active') : ''}`}>
                <div className="step-icon">{stepIndex > 2 ? '✓' : '2'}</div>
                Requesting ride...
              </div>
              <div className={`step ${stepIndex >= 3 ? (stepIndex > 3 ? 'done' : 'active') : ''}`}>
                <div className="step-icon">{stepIndex > 3 ? '✓' : '3'}</div>
                Finding driver...
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={handleGetPrice}
              disabled={loading}
            >
              {step === 'pricing' ? <span className="spinner" /> : '💰 Get Estimate'}
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleRequestRide}
              disabled={loading}
            >
              {loading && step !== 'pricing' ? <span className="spinner" /> : '🚗 Request Ride'}
            </button>
          </div>
        </>
      ) : (
        <div>
          <div className="alert alert-success">
            🎉 Driver matched! Your ride is confirmed.
          </div>

          {rideResult && (
            <div style={{ fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ride ID</span>
                <strong>#{rideResult.ride_id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Driver ID</span>
                <strong>#{rideResult.driver_id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>ETA</span>
                <strong>{rideResult.estimated_arrival || '5 minutes'}</strong>
              </div>
              {rideResult.estimated_price && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fare</span>
                  <strong style={{ color: 'var(--primary)' }}>${rideResult.estimated_price.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          <button className="btn btn-outline btn-lg" style={{ marginTop: '1rem' }} onClick={handleReset}>
            Request Another Ride
          </button>
        </div>
      )}
    </div>
  );
}

export default RideRequest;
