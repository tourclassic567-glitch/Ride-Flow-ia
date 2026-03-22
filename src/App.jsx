import React, { useState } from 'react';

const App = () => {
    const [isDriver, setIsDriver] = useState(false);

    const switchRole = () => {
        setIsDriver(!isDriver);
    };

    return (
        <div>
            <h1>{isDriver ? 'Driver Mode' : 'Passenger Mode'}</h1>
            <button onClick={switchRole}>Switch to {isDriver ? 'Passenger' : 'Driver'} Mode</button>

            {isDriver ? (
                <div>
                    <h2>Driver Interface</h2>
                    {/* Driver specific components would go here */}
                </div>
            ) : (
                <div>
                    <h2>Passenger Interface</h2>
                    {/* Passenger specific components would go here */}
                </div>
            )}
        </div>
    );
};

export default App;