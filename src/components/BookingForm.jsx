import React, { useState } from 'react';

const BookingForm = () => {
    const [passengerName, setPassengerName] = useState('');
    const [journeyDate, setJourneyDate] = useState('');
    const [destination, setDestination] = useState('');

    const handleSubmit = (event) => {
        event.preventDefault();
        // Handle booking submit logic here
        console.log(`Booking for ${passengerName} to ${destination} on ${journeyDate}`);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label>Passenger Name:</label>
                <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    required
                />
            </div>
            <div>
                <label>Journey Date:</label>
                <input
                    type="date"
                    value={journeyDate}
                    onChange={(e) => setJourneyDate(e.target.value)}
                    required
                />
            </div>
            <div>
                <label>Destination:</label>
                <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                />
            </div>
            <button type="submit">Create Booking</button>
        </form>
    );
};

export default BookingForm;