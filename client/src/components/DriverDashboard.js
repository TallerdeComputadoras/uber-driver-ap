import React, { useState, useEffect, useCallback } from 'react';

function DriverDashboard({ token: propToken }) {
  const token = propToken || localStorage.getItem('token') || '';
  const currentUserId = localStorage.getItem('userId') || '';
  const currentUserName = localStorage.getItem('userName') || 'Conductor';

  // State for pre-trip form
  const [startMileage, setStartMileage] = useState('');
  const [startFuelLevel, setStartFuelLevel] = useState('');

  // State for post-trip form
  const [endMileage, setEndMileage] = useState('');
  const [endFuelLevel, setEndFuelLevel] = useState('');
  const [fuelLitersAdded, setFuelLitersAdded] = useState('');
  const [moneyObtained, setMoneyObtained] = useState('');

  // Notifications / feedback
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loadingTrip, setLoadingTrip] = useState(false);

  // State for stats
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState(currentUserId);
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState({
    tripCount: 0,
    totalKm: 0,
    totalMoney: 0,
    totalFuelCost: 0,
    netProfit: 0,
    loading: true,
  });

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Fetch driver options
  useEffect(() => {
    const fetchUserAndDrivers = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const user = await res.json();
          setDrivers([
            { _id: user._id, name: user.name + ' (Yo)' }
          ]);
          if (!selectedDriverId) {
            setSelectedDriverId(user._id);
          }
        }
      } catch (err) {
        console.error('Error fetching driver profile:', err);
      }
    };
    fetchUserAndDrivers();
  }, [token, selectedDriverId]);

  // Fetch stats callback
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      setStats((prev) => ({ ...prev, loading: true }));
      const url = `/api/driver/stats?period=${period}${selectedDriverId ? `&driverId=${selectedDriverId}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          tripCount: data.tripCount || 0,
          totalKm: data.totalKilometers || 0,
          totalMoney: data.totalMoneyObtained || 0,
          totalFuelCost: data.totalFuelCost || 0,
          netProfit: (data.totalMoneyObtained || 0) - (data.totalFuelCost || 0),
          loading: false,
        });
      } else {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }, [token, period, selectedDriverId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handle pre-trip
  const handleStartTrip = async (e) => {
    e.preventDefault();
    if (!startMileage || !startFuelLevel) {
      showNotification('error', 'Ingresa el kilometraje y nivel de combustible.');
      return;
    }
    setLoadingTrip(true);
    try {
      const res = await fetch('/api/driver/pre-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startMileage: Number(startMileage),
          startFuelLevel: Number(startFuelLevel),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || 'Jornada iniciada con éxito.');
        setStartMileage('');
        setStartFuelLevel('');
        fetchStats();
      } else {
        showNotification('error', data.message || 'Error al guardar el inicio de jornada.');
      }
    } catch (err) {
      showNotification('error', 'Error al conectar con el servidor.');
    } finally {
      setLoadingTrip(false);
    }
  };

  // Handle post-trip
  const handleEndTrip = async (e) => {
    e.preventDefault();
    if (!endMileage || !endFuelLevel || moneyObtained === '') {
      showNotification('error', 'Completa los campos para finalizar la jornada.');
      return;
    }
    setLoadingTrip(true);
    try {
      const res = await fetch('/api/driver/post-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endMileage: Number(endMileage),
          endFuelLevel: Number(endFuelLevel),
          fuelLitersAdded: Number(fuelLitersAdded) || 0,
          moneyObtained: Number(moneyObtained),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || 'Jornada finalizada y calculada exitosamente.');
        setEndMileage('');
        setEndFuelLevel('');
        setFuelLitersAdded('');
        setMoneyObtained('');
        fetchStats();
      } else {
        showNotification('error', data.message || 'Error al finalizar la jornada.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexión con el servidor.');
    } finally {
      setLoadingTrip(false);
    }
  };

  const periodLabels = {
    day: 'Hoy',
    week: 'Esta Semana',
    month: 'Este Mes',
    year: 'Este Año',
  };

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Panel de Conductor
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Bienvenido, <strong style={{ color: 'var(--text-primary)' }}>{currentUserName}</strong>. Registra tus viajes y revisa tu rendimiento.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Action Cards (Pre-trip & Post-trip) */}
      <div className="dashboard-grid">
        {/* Pre-trip Card */}
        <div className="card">
          <div className="card-title">
            <span style={{ fontSize: '1.4rem' }}>🟢</span>
            <span>Iniciar Jornada (Pre-Trip)</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Registra los datos del vehículo antes de salir a la calle.
          </p>
          <form onSubmit={handleStartTrip}>
            <div className="form-group">
              <label className="form-label">Kilometraje Odómetro Inicial (km)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-input"
                placeholder="Ej: 142500"
                value={startMileage}
                onChange={(e) => setStartMileage(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nivel de Combustible Inicial (% o Litros)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                className="form-input"
                placeholder="Ej: 80 (%)"
                value={startFuelLevel}
                onChange={(e) => setStartFuelLevel(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loadingTrip}
              style={{ marginTop: '0.5rem' }}
            >
              {loadingTrip ? 'Guardando...' : 'Iniciar Turno'}
            </button>
          </form>
        </div>

        {/* Post-trip Card */}
        <div className="card">
          <div className="card-title">
            <span style={{ fontSize: '1.4rem' }}>🏁</span>
            <span>Finalizar Jornada (Post-Trip)</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Registra el fin de tu turno para calcular consumo, km y rendición.
          </p>
          <form onSubmit={handleEndTrip}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Odómetro Final (km)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-input"
                  placeholder="Ej: 142750"
                  value={endMileage}
                  onChange={(e) => setEndMileage(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nivel Final Combustible (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  className="form-input"
                  placeholder="Ej: 45 (%)"
                  value={endFuelLevel}
                  onChange={(e) => setEndFuelLevel(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Nafta Cargada (Litros)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-input"
                  placeholder="0 si no cargaste"
                  value={fuelLitersAdded}
                  onChange={(e) => setFuelLitersAdded(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dinero Recaudado ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="Ej: 35000"
                  value={moneyObtained}
                  onChange={(e) => setMoneyObtained(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-danger"
              disabled={loadingTrip}
              style={{ marginTop: '0.5rem' }}
            >
              {loadingTrip ? 'Calculando...' : 'Cerrar Turno y Calcular Rendición'}
            </button>
          </form>
        </div>
      </div>

      {/* Filter and Period Controls */}
      <div className="filter-bar">
        <div className="filter-item">
          <span className="filter-label">Período de Análisis:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="day">Día actual</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="year">Este año</option>
          </select>
        </div>

        {drivers.length > 1 && (
          <div className="filter-item">
            <span className="filter-label">Conductor:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
            >
              {drivers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="stat-card-label">Turnos / Viajes</div>
          <div className="stat-card-value">{stats.tripCount}</div>
          <div className="stat-card-sub">{periodLabels[period]}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Kilómetros Totales</div>
          <div className="stat-card-value">{(stats.totalKm || 0).toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>km</span></div>
          <div className="stat-card-sub">Distancia recorrida</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Ingreso Bruto</div>
          <div className="stat-card-value" style={{ color: '#38bdf8' }}>
            ${(stats.totalMoney || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">Dinero obtenido</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Costo Combustible</div>
          <div className="stat-card-value" style={{ color: '#f87171' }}>
            ${(stats.totalFuelCost || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">Gasto estimado</div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(145deg, #111827 0%, #064e3b 100%)' }}>
          <div className="stat-card-label" style={{ color: '#a7f3d0' }}>Ganancia Neta</div>
          <div className="stat-card-value" style={{ color: '#34d399' }}>
            ${(stats.netProfit || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub" style={{ color: '#6ee7b7' }}>Bruto - Combustible</div>
        </div>
      </div>

      {/* Visual Resource Distribution */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title">
          <span>📊</span>
          <span>Eficiencia y Distribución de Recursos</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Relación entre ingresos totales y costo de combustible consumido en el período ({periodLabels[period]}):
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#34d399', fontWeight: 600 }}>Rendimiento Neto</span>
                <span>
                  {stats.totalMoney > 0
                    ? `${Math.max(0, Math.round((stats.netProfit / stats.totalMoney) * 100))}%`
                    : '100%'}
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-input)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${stats.totalMoney > 0 ? Math.min(100, Math.max(0, (stats.netProfit / stats.totalMoney) * 100)) : 100}%`,
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '9999px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#f87171', fontWeight: 600 }}>Impacto del Combustible</span>
                <span>
                  {stats.totalMoney > 0
                    ? `${Math.min(100, Math.round((stats.totalFuelCost / stats.totalMoney) * 100))}%`
                    : '0%'}
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-input)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${stats.totalMoney > 0 ? Math.min(100, (stats.totalFuelCost / stats.totalMoney) * 100) : 0}%`,
                    background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                    borderRadius: '9999px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Resumen Operativo
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Ingreso Promedio por KM:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {stats.totalKm > 0 ? `$${(stats.totalMoney / stats.totalKm).toFixed(2)}/km` : '$0.00/km'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Costo de Nafta por KM:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {stats.totalKm > 0 ? `$${(stats.totalFuelCost / stats.totalKm).toFixed(2)}/km` : '$0.00/km'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Ganancia Neta por KM:</span>
                <strong style={{ color: '#34d399' }}>
                  {stats.totalKm > 0 ? `$${(stats.netProfit / stats.totalKm).toFixed(2)}/km` : '$0.00/km'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverDashboard;