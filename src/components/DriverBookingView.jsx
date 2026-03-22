import React from 'react';

const DriverBookingView = ({ bookings, onAccept, onReject }) => {
    return (
        <div>
            <h1>Driver Booking View</h1>
            <ul>
                {bookings.map((booking) => (
                    <li key={booking.id}>
                        <h2>Booking ID: {booking.id}</h2>
                        <p>Passenger: {booking.passengerName}</p>
                        <p>Pickup Location: {booking.pickupLocation}</p>
                        <p>Dropoff Location: {booking.dropoffLocation}</p>
                        <button onClick={() => onAccept(booking.id)}>Accept</button>
                        <button onClick={() => onReject(booking.id)}>Reject</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default DriverBookingView;
