import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PasswordInput from './PasswordInput';

function Login({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para modal / vista de "Olvidé mi contraseña"
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { identifier, password } = formData;
    if (!identifier || !password) {
      setError('Por favor ingresa tu identificador y contraseña.');
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

  // Enviar solicitud de reseteo de contraseña antes del login
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotMessage({ type: 'error', text: 'Ingresa tu correo registrado.' });
      return;
    }
    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMessage({
          type: 'success',
          text:
            data.message +
            (data.tempPasswordNotice ? `\n${data.tempPasswordNotice}` : ''),
        });
      } else {
        setForgotMessage({ type: 'error', text: data.message || 'Error al procesar la solicitud.' });
      }
    } catch (err) {
      setForgotMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1 className="auth-title">Iniciar Sesión</h1>
        <p className="auth-subtitle">Accede a tu cuenta de conductor o administración</p>
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
            Correo Electrónico o Usuario
          </label>
          <input
            id="identifier"
            type="text"
            name="identifier"
            className="form-input"
            placeholder="ejemplo@correo.com"
            value={formData.identifier}
            onChange={handleChange}
            autoComplete="username"
            required
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <label className="form-label" htmlFor="password" style={{ margin: 0 }}>
              Contraseña
            </label>
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotMessage({ type: '', text: '' });
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <PasswordInput
            id="password"
            name="password"
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
          style={{ opacity: loading ? 0.7 : 1, marginTop: '0.75rem' }}
        >
          {loading ? 'Verificando...' : 'Entrar al Sistema'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>¿No tienes cuenta registrada? </span>
        <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Regístrate aquí
        </Link>
      </div>

      {/* Modal de Olvidé mi Contraseña */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                🔑 Recuperar Contraseña
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowForgotModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Ingresa tu correo registrado. Te enviaremos una <strong>nueva contraseña provisoria aleatoria</strong> para que puedas iniciar sesión e inmediatamente cambiarla desde tu panel.
            </p>

            {forgotMessage.text && (
              <div
                className={`alert ${forgotMessage.type === 'error' ? 'alert-error' : 'alert-success'}`}
                style={{ whiteSpace: 'pre-line' }}
              >
                <span>{forgotMessage.type === 'error' ? '⚠️' : '✅'}</span>
                <span>{forgotMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit}>
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="tu@correo.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForgotModal(false)}
                  style={{ flex: 1 }}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={forgotLoading}
                  style={{ flex: 1.5 }}
                >
                  {forgotLoading ? 'Enviando...' : 'Generar y Enviar Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;