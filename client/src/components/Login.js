import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function Login({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { identifier, password } = formData;
    if (!identifier || !password) {
      setError('Ingresa tu identificador y contraseña.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        if (onLoginSuccess) {
          onLoginSuccess(data);
        } else {
          localStorage.setItem('token', data.token);
          localStorage.setItem('userRole', data.role);
          localStorage.setItem('userName', data.name);
          if (data._id) localStorage.setItem('userId', data._id);
          window.location.href = data.role === 'admin' ? '/admin' : '/driver';
        }
      } else {
        setError(data.message || 'Credenciales inválidas. Revisa los datos.');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to fill demo credentials
  const fillDemoCredentials = (id, pass) => {
    setFormData({ identifier: id, password: pass });
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1 className="auth-title">Iniciar Sesión</h1>
        <p className="auth-subtitle">Accede a tu panel de conductor o administración</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="identifier">
            Correo o Usuario Administrador
          </label>
          <input
            id="identifier"
            type="text"
            name="identifier"
            className="form-input"
            placeholder="ejemplo@correo.com o Administrador"
            value={formData.identifier}
            onChange={handleChange}
            autoComplete="username"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            name="password"
            className="form-input"
            placeholder="••••••••••••"
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1, marginTop: '0.5rem' }}
        >
          {loading ? 'Verificando...' : 'Entrar al Sistema'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>¿No tienes cuenta? </span>
        <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Regístrate aquí
        </Link>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
          💡 Acceso rápido para pruebas:
        </div>
        <div>
          Admin: <strong>Administrador</strong> / <strong>Chofer4059!</strong>{' '}
          <button
            type="button"
            onClick={() => fillDemoCredentials('Administrador', 'Chofer4059!')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontSize: '0.8rem',
            }}
          >
            (completar)
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;