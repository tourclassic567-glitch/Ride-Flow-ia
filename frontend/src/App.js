import React, { useState } from 'react';
import './App.css';
import Login from './components/Auth/Login';
import PassengerView from './components/Passenger/PassengerView';
import DriverView from './components/Driver/DriverView';

function App() {
  const [role, setRole] = useState('passenger');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  function handleLogin(userData) {
    setUser(userData);
    setRole(userData.role);
    setIsLoggedIn(true);
  }

  function handleLogout() {
    setUser(null);
    setIsLoggedIn(false);
    setRole('passenger');
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🚗 Ride-Flow IA</h1>
        <div className="header-right">
          <span className="user-email">{user && user.email}</span>
          <div className="role-switcher">
            <button
              className={`role-btn ${role === 'passenger' ? 'active' : ''}`}
              onClick={() => setRole('passenger')}
            >
              Passenger
            </button>
            <button
              className={`role-btn ${role === 'driver' ? 'active' : ''}`}
              onClick={() => setRole('driver')}
            >
              Driver
            </button>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        {role === 'passenger' ? (
          <PassengerView user={user} />
        ) : (
          <DriverView user={user} />
        )}
      </main>
    </div>
  );
}

export default App;
