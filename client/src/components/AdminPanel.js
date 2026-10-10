import React, { useState, useEffect, useCallback } from 'react';

function AdminPanel({ token: propToken }) {
  const [token, setToken] = useState(propToken || localStorage.getItem('token') || '');
  const [userRole] = useState(localStorage.getItem('userRole') || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(userRole === 'admin');

  // Fuel price state
  const [currentFuelPrice, setCurrentFuelPrice] = useState(null);
  const [fuelPriceInput, setFuelPriceInput] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // Rendition & drivers state
  const [driversStats, setDriversStats] = useState([]);
  const [selectedDriverForRendition, setSelectedDriverForRendition] = useState('');
  const [periodForStats, setPeriodForStats] = useState('month');
  const [loadingStats, setLoadingStats] = useState(false);

  // Alerts
  const [alert, setAlert] = useState({ type: '', message: '' });

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 5000);
  };

  // Fetch current fuel price
  const fetchCurrentFuelPrice = async () => {
    try {
      const res = await fetch('/api/admin/fuel-price');
      if (res.ok) {
        const data = await res.json();
        setCurrentFuelPrice(data.pricePerLiter);
      }
    } catch (err) {
      console.error('Error fetching fuel price:', err);
    }
  };

  // Fetch drivers stats
  const fetchDriversStats = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/admin/drivers-stats?period=${periodForStats}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDriversStats(data.drivers || []);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [token, periodForStats]);

  useEffect(() => {
    fetchCurrentFuelPrice();
  }, []);

  useEffect(() => {
    if (isAuthenticatedAdmin && token) {
      fetchDriversStats();
    }
  }, [isAuthenticatedAdmin, token, fetchDriversStats]);

  // Admin authentication (if not already logged in as admin)
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'Administrador', password: adminPassword }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userName', data.name);
        setIsAuthenticatedAdmin(true);
        showAlert('success', 'Autenticación de Administrador exitosa.');
      } else {
        showAlert('error', data.message || 'Contraseña de administrador incorrecta.');
      }
    } catch (err) {
      showAlert('error', 'Error al conectar con el servidor.');
    }
  };

  // Update fuel price
  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    if (!fuelPriceInput || isNaN(Number(fuelPriceInput)) || Number(fuelPriceInput) <= 0) {
      showAlert('error', 'Por favor ingresa un precio de nafta válido y mayor a cero.');
      return;
    }
    setUpdatingPrice(true);
    try {
      const res = await fetch('/api/admin/fuel-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pricePerLiter: Number(fuelPriceInput) }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentFuelPrice(data.pricePerLiter);
        setFuelPriceInput('');
        showAlert('success', `Precio de combustible actualizado a $${data.pricePerLiter}/litro.`);
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al actualizar precio.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    } finally {
      setUpdatingPrice(false);
    }
  };

  // Mark monthly rendition as paid
  const handleMarkRendition = async (e) => {
    e.preventDefault();
    if (!selectedDriverForRendition) {
      showAlert('error', 'Selecciona un conductor de la lista.');
      return;
    }
    try {
      const res = await fetch('/api/admin/monthly-rendition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ driverId: selectedDriverForRendition }),
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', data.message || 'Rendición marcada como abonada exitosamente.');
        setSelectedDriverForRendition('');
      } else {
        showAlert('error', data.message || 'Error al marcar rendición.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Fleet totals
  const totalFleetKm = driversStats.reduce((sum, d) => sum + (d.totalKilometers || 0), 0);
  const totalFleetMoney = driversStats.reduce((sum, d) => sum + (d.totalMoney || 0), 0);
  const totalFleetFuelCost = driversStats.reduce((sum, d) => sum + (d.totalFuelCost || 0), 0);
  const totalFleetTrips = driversStats.reduce((sum, d) => sum + (d.trips || 0), 0);

  if (!isAuthenticatedAdmin) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">Panel de Administración</h1>
          <p className="auth-subtitle">Ingresa la clave maestra de administrador</p>
        </div>

        {alert.message && (
          <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
            <span>{alert.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{alert.message}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label className="form-label">Contraseña de Administrador</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary">
            Desbloquear Panel
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Credencial por defecto: <strong>Chofer4059!</strong>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Centro de Control Administrador
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
          Gestión de precios de combustible, supervisión de la flota y rendiciones mensuales.
        </p>
      </div>

      {alert.message && (
        <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{alert.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{alert.message}</span>
        </div>
      )}

      {/* Fleet Totals Grid */}
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="stat-card-label">Conductores Activos</div>
          <div className="stat-card-value">{driversStats.length}</div>
          <div className="stat-card-sub">En flota</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Viajes Totales</div>
          <div className="stat-card-value">{totalFleetTrips}</div>
          <div className="stat-card-sub">En el período</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">KM Totales Flota</div>
          <div className="stat-card-value">{totalFleetKm.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>km</span></div>
          <div className="stat-card-sub">Recorrido global</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Recaudación Bruta</div>
          <div className="stat-card-value" style={{ color: '#38bdf8' }}>
            ${totalFleetMoney.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">Total generado</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Costo Combustible Flota</div>
          <div className="stat-card-value" style={{ color: '#f87171' }}>
            ${totalFleetFuelCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">Gasto total en nafta</div>
        </div>
      </div>

      {/* Admin Action Panels */}
      <div className="dashboard-grid">
        {/* Fuel price config */}
        <div className="card">
          <div className="card-title">
            <span>⛽</span>
            <span>Precio del Litro de Nafta</span>
          </div>

          <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Precio Oficial Actual:</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
              {currentFuelPrice !== null ? `$${Number(currentFuelPrice).toFixed(2)} / litro` : 'Cargando...'}
            </div>
          </div>

          <form onSubmit={handleUpdatePrice}>
            <div className="form-group">
              <label className="form-label">Nuevo Valor por Litro ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="Ej: 950.50"
                value={fuelPriceInput}
                onChange={(e) => setFuelPriceInput(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={updatingPrice}>
              {updatingPrice ? 'Actualizando...' : 'Actualizar Precio Global'}
            </button>
          </form>
        </div>

        {/* Rendition mark as paid */}
        <div className="card">
          <div className="card-title">
            <span>💳</span>
            <span>Rendición Mensual de Conductores</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Marca la rendición del mes correspondiente como liquidada y pagada.
          </p>

          <form onSubmit={handleMarkRendition}>
            <div className="form-group">
              <label className="form-label">Seleccionar Conductor</label>
              <select
                className="form-select"
                value={selectedDriverForRendition}
                onChange={(e) => setSelectedDriverForRendition(e.target.value)}
                required
              >
                <option value="">-- Elige un conductor --</option>
                {driversStats.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} (${(d.totalMoney || 0).toFixed(2)} recaudados)
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
              Marcar Rendición como Abonada
            </button>
          </form>
        </div>
      </div>

      {/* Drivers performance table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="card-title" style={{ margin: 0 }}>
            <span>📋</span>
            <span>Desempeño y Rendimiento de Conductores</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Período:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.4rem 0.8rem' }}
              value={periodForStats}
              onChange={(e) => setPeriodForStats(e.target.value)}
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
            </select>
          </div>
        </div>

        {loadingStats ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Cargando estadísticas...</p>
        ) : driversStats.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No hay registros de viajes en el período seleccionado.</p>
        ) : (
          <div className="table-container">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Correo</th>
                  <th>Viajes</th>
                  <th>KM Recorridos</th>
                  <th>Recaudación ($)</th>
                  <th>Costo Nafta ($)</th>
                  <th>Ganancia Neta ($)</th>
                </tr>
              </thead>
              <tbody>
                {driversStats.map((d) => (
                  <tr key={d._id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{d.email}</td>
                    <td><span className="badge badge-info">{d.trips || 0}</span></td>
                    <td>{(d.totalKilometers || 0).toFixed(1)} km</td>
                    <td style={{ color: '#38bdf8', fontWeight: 600 }}>${(d.totalMoney || 0).toFixed(2)}</td>
                    <td style={{ color: '#f87171' }}>${(d.totalFuelCost || 0).toFixed(2)}</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>${(d.netProfit || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;