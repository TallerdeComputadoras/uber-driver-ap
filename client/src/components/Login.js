import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Login() {
  const [formData, setFormData] = useState({
    identifier: '', // email or "Administrador"
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { identifier, password } = formData;
    // Send to backend auth API
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userName', data.name);
        setFormData({ identifier: '', password: '' });
        navigate('/driver');
      } else {
        setError(data.message || 'Error de login');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Iniciar sesión</h2>
      {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Correo electrónico o "Administrador"</label>
          <input
            type="text"
            name="identifier"
            placeholder="ejemplo@correo.com o Administrador"
            value={formData.identifier}
            onChange={handleChange}
            required
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Contraseña</label>
          <input
            type="password"
            name="password"
            placeholder="•••••••"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Entrar
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        ¿No tienes cuenta? <Link to="/register" style={{ color: '#0066cc', textDecoration: 'underline' }}>Regístrate aquí</Link>
      </p>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <small>Credenciales de administrador: usuario: <strong>Administrador</strong> contraseña: <strong>Chofer4059!</strong></small>
      </p>
    </div>
  );
}

export default Login;