import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminForm, setShowAdminForm] = useState(false);

  // Authenticate as admin
  const authenticateAdmin = async (pwd) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'Administrador', password: pwd }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setShowAdminForm(true);
        alert('Autenticación de administrador exitosa');
      } else {
        alert(data.message || 'Credenciales incorrectas');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // If token already indicates admin, show form directly
  useEffect(() => {
    if (token) {
      // Verify role
      try {
        const res = fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        // We'll just assume if password was correct, show form
      } catch (e) {}
    }
  }, [token]);

  // State for fuel price
  const [fuelPrice, setFuelPrice] = useState('');
  const [fuelPriceError, setFuelPriceError] = useState('');
  const [driversStats, setDriversStats] = useState([]);
  const [selectedDriverForStats, setSelectedDriverForStats] = useState('');
  const [periodForStats, setPeriodForStats] = useState('month');
  const [monthlyRendition, setMonthlyRendition] = useState('');

  // Authenticate on mount if password provided
  useEffect(() => {
    if (!token && adminPassword) {
      authenticateAdmin(adminPassword);
    }
  }, [token, adminPassword]);

  // Fetch drivers stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        const res = await fetch(`/api/admin/drivers-stats?period=${periodForStats}&driverId=${selectedDriverForStats || ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setDriversStats(data.drivers || []);
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      }
    };
    fetchStats();
  }, [token, periodForStats, selectedDriverForStats]);

  // Update fuel price
  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    if (!fuelPrice || isNaN(Number(fuelPrice))) {
      setFuelPriceError('Ingresa un precio válido');
      return;
    }
    try {
      const res = await fetch('/api/admin/fuel-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pricePerLiter: Number(fuelPrice) }),
      });
      const data = await res.json();
      if (res.ok) {
        setFuelPrice('');
        setFuelPriceError('');
        alert('Precio de nafta actualizado');
        // Refresh stats
        fetchStats();
      } else {
        setFuelPriceError(data.message || 'Error al actualizar');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // Mark monthly rendition as paid
  const handleMarkRendition = async (e) => {
    e.preventDefault();
    if (!selectedDriverForStats) {
      alert('Selecciona un conductor');
      return;
    }
    try {
      const res = await fetch('/api/admin/monthly-rendition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ driverId: selectedDriverForStats }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setMonthlyRendition('');
      } else {
        alert(data.message || 'Error');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {showAdminForm ? (
        <div style={{ background: '#f8f9fa', padding: '2rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <h2>Panel de Administrador</h2>
          
          {/* Fuel price section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3>Establecer precio de nafta por litro</h3>
            <p>Precio actual: <span id="current-price">Cargando...</span></p>
            <form onSubmit={handleUpdatePrice}>
              <input
                type="number"
                id="fuelPriceInput"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
                min="0"
                step="0.01"
                style={{ width: '100%', padding: '0.5rem' }}
                required
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', marginTop: '0.5rem' }}>
                Actualizar precio
              </button>
              <span style={{ color: 'red', marginLeft: '0.5rem', display: block }}>{fuelPriceError}</span>
            </form>
          </div>

          {/* Monthly rendition section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3>Marcar rendición mensual como abonada</h3>
            <form onSubmit={handleMarkRendition}>
              <select
                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                onChange={(e) => setSelectedDriverForStats(e.target.value)}
                defaultValue={selectedDriverForStats}
              >
                <option value="">-- Seleccionar conductor --</option>
                {driversStats.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} - ${d.totalMoney.toFixed(2)} ganado
                  </option>
                ))}
              </select>
              <button type="submit" style={{ padding: '0.5rem 1rem', background: '#20c997', color: '#fff', border: 'none', borderRadius: '4px' }}>
                Marcar como abonado
              </button>
            </form>
          </div>

          {/* Drivers stats list */}
          <div>
            <h3>Estadísticas de conductores</h3>
            <p>Período: 
              <select
                style={{ padding: '0.3rem' }}
                onChange={(e) => setPeriodForStats(e.target.value)}
                defaultValue={periodForStats}
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month" selected>Mes</option>
                <option value="year">Año</option>
              </select>
            </p>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#e9ecef' }}>
                    <th style={{ padding: '0.5rem' }}>Conductor</th>
                    <th style={{ padding: '0.5rem' }}>Viajes</th>
                    <th style={{ padding: '0.5rem' }}>Km total</th>
                    <th style={{ padding: '0.5rem' }}>Dinero total</th>
                    <th style={{ padding: '0.5rem' }}>Costo combustible</th>
                  </tr>
                </thead>
                <tbody>
                  {driversStats.map((d) => (
                    <tr key={d._id}>
                      <td style={{ padding: '0.5rem' }}>{d.name}</td>
                      <td style={{ padding: '0.5rem' }}>{d.trips}</td>
                      <td style={{ padding: '0.5rem' }}>{d.totalKilometers.toFixed(2)} km</td>
                      <td style={{ padding: '0.5rem' }}>${d.totalMoney.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem' }}>${d.totalFuelCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // Login form for admin
        <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Panel de Administración</h2>
          <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            Ingresa la contraseña de administrador
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            authenticateAdmin(adminPassword);
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Contraseña</label>
              <input
                type="password"
                name="adminPassword"
                placeholder="Contraseña del administrador"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Entrar al panel
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem' }}>
            Credenciales: usuario: <strong>Administrador</strong> contraseña: <strong>Chofer4059!</strong>
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;