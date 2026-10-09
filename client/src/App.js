import React, { useState, useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import DriverDashboard from './components/DriverDashboard';
import AdminPanel from './components/AdminPanel';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in via token
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token with backend (could decode JWT or just check presence)
      // For now, assume if token exists, user is logged in
      setIsLoggedIn(true);
      // Determine role from localStorage or default
      const role = localStorage.getItem('userRole');
      setUserRole(role ? role : 'driver');
    }
    // If no token and on protected route, go to login
    if (!token && navigate.pathname !== '/login') {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <nav style={{ padding: '1rem', background: '#222', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>UberDriver Clone</span>
          {isLoggedIn && (
            <span style={{ marginRight: '2rem' }}>Bienvenido, {localStorage.getItem('userName') || ''}</span>
          )}
          {!isLoggedIn && (
            <span>
              <a href="/login" style={{ color: 'white', textDecoration: 'none' }}>Iniciar sesión</a> | 
              <a href="/register" style={{ color: 'white', textDecoration: 'none' }}>Registrarse</a>
            </span>
          )}
          {isLoggedIn && userRole === 'admin' && (
            <a href="/admin" style={{ color: 'white', textDecoration: 'none' }}>Panel Admin</a>
          )}
        </div>
      </nav>
      <hr style={{ margin: '1rem 0' }} />
      <Routes>
        {isLoggedIn ? (
          // Protected routes
          <Route path="/driver" element={<DriverDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
        ) : (
          // Public routes
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        )}
      </Routes>
    </div>
  );
}

export default App;