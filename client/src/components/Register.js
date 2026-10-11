import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PasswordInput from './PasswordInput';

function Register({ onRegisterSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
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
    const { name, email, password } = formData;
    if (!name || !email || !password) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        if (onRegisterSuccess) {
          onRegisterSuccess(data);
        } else {
          localStorage.setItem('token', data.token);
          localStorage.setItem('userRole', data.role);
          localStorage.setItem('userName', data.name);
          if (data._id) localStorage.setItem('userId', data._id);
          window.location.href = '/driver';
        }
      } else {
        setError(data.message || 'Error al procesar el registro.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1 className="auth-title">Crear Cuenta</h1>
        <p className="auth-subtitle">Regístrate como conductor para llevar el control de tus turnos</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Nombre Completo
          </label>
          <input
            id="name"
            type="text"
            name="name"
            className="form-input"
            placeholder="Ej: Juan Pérez"
            value={formData.name}
            onChange={handleChange}
            autoComplete="name"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Correo Electrónico
          </label>
          <input
            id="email"
            type="email"
            name="email"
            className="form-input"
            placeholder="conductor@correo.com"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Mínimo 6 caracteres"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1, marginTop: '0.75rem' }}
        >
          {loading ? 'Registrando...' : 'Comenzar Ahora'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>¿Ya tienes cuenta registrada? </span>
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}

export default Register;