import React, { useState, useEffect, useCallback } from 'react';
import { Route, Routes, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import DriverDashboard from './components/DriverDashboard';
import AdminPanel from './components/AdminPanel';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const navigate = useNavigate();
  const location = useLocation();

  // Helper to handle login
  const handleAuthSuccess = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('userRole', userData.role);
    localStorage.setItem('userName', userData.name);
    if (userData._id) {
      localStorage.setItem('userId', userData._id);
    }
    setToken(userData.token);
    setUserRole(userData.role);
    setUserName(userData.name);

    if (userData.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/driver');
    }
  };

  // Helper to logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    setToken('');
    setUserRole('');
    setUserName('');
    navigate('/login');
  }, [navigate]);

  // Sync auth state if token is changed or removed
  useEffect(() => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken && token) {
      handleLogout();
    }
  }, [location.pathname, token, handleLogout]);

  const isLoggedIn = Boolean(token);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header className="app-nav">
        <div className="nav-container">
          <Link to={isLoggedIn ? (userRole === 'admin' ? '/admin' : '/driver') : '/login'} className="nav-brand">
            <span>🚗 DriverControl</span>
            <span className="nav-brand-badge">PRO</span>
          </Link>

          <nav className="nav-links">
            {isLoggedIn ? (
              <>
                <Link
                  to="/driver"
                  className={`nav-link ${location.pathname === '/driver' ? 'active' : ''}`}
                >
                  Panel Conductor
                </Link>
                {userRole === 'admin' && (
                  <Link
                    to="/admin"
                    className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
                  >
                    Panel Admin
                  </Link>
                )}
                <div className="nav-user">
                  <div className="user-avatar-circle">
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span>{userName || 'Usuario'}</span>
                  {userRole === 'admin' && <span className="badge badge-info">Admin</span>}
                </div>
                <button onClick={handleLogout} className="btn-logout" title="Cerrar sesión">
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}
                >
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-wrapper" style={{ flex: 1 }}>
        <Routes>
          <Route
            path="/"
            element={
              isLoggedIn ? (
                userRole === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/driver" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to={userRole === 'admin' ? '/admin' : '/driver'} replace />
              ) : (
                <Login onLoginSuccess={handleAuthSuccess} />
              )
            }
          />
          <Route
            path="/register"
            element={
              isLoggedIn ? (
                <Navigate to="/driver" replace />
              ) : (
                <Register onRegisterSuccess={handleAuthSuccess} />
              )
            }
          />
          <Route
            path="/driver"
            element={
              isLoggedIn ? (
                <DriverDashboard token={token} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              isLoggedIn ? (
                <AdminPanel token={token} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;