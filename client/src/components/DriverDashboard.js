import React, { useState, useEffect, useCallback } from 'react';
import InfoBadge from './InfoBadge';

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
  const [lastClosedTrip, setLastClosedTrip] = useState(null);

  // Shifts history
  const [myTrips, setMyTrips] = useState([]);
  const [loadingTripsList, setLoadingTripsList] = useState(false);

  // State for stats
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState({
    tripCount: 0,
    totalKm: 0,
    totalMoney: 0,
    totalFuelCost: 0,
    netProfit: 0,
    totalCarWear: 0,
    totalCarReplacement: 0,
    totalTransfers: 0,
    pendingApprovalTransfersCount: 0,
    loading: true,
  });

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 6000);
  };

  // Fetch recent trips of this driver
  const fetchMyTrips = useCallback(async () => {
    if (!token) return;
    setLoadingTripsList(true);
    try {
      const res = await fetch('/api/driver/my-trips', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyTrips(data.trips || []);
        // Si hay un turno recién finalizado sin transferir, guardarlo como último turno
        if (data.trips && data.trips.length > 0 && !lastClosedTrip) {
          setLastClosedTrip(data.trips[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching driver trips:', err);
    } finally {
      setLoadingTripsList(false);
    }
  }, [token, lastClosedTrip]);

  // Fetch stats callback
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      setStats((prev) => ({ ...prev, loading: true }));
      const url = `/api/driver/stats?period=${period}&driverId=${currentUserId}`;
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
          netProfit: data.netProfit || 0,
          totalCarWear: data.totalCarWear || 0,
          totalCarReplacement: data.totalCarReplacement || 0,
          totalTransfers: data.totalTransfers || 0,
          pendingApprovalTransfersCount: data.pendingApprovalTransfersCount || 0,
          loading: false,
        });
      } else {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }, [token, period, currentUserId]);

  useEffect(() => {
    fetchStats();
    fetchMyTrips();
  }, [fetchStats, fetchMyTrips]);

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
        fetchMyTrips();
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
        showNotification('success', data.message || 'Jornada finalizada y métricas calculadas con éxito.');
        setLastClosedTrip(data.trip);
        setEndMileage('');
        setEndFuelLevel('');
        setFuelLitersAdded('');
        setMoneyObtained('');
        fetchStats();
        fetchMyTrips();
      } else {
        showNotification('error', data.message || 'Error al finalizar la jornada.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexión con el servidor.');
    } finally {
      setLoadingTrip(false);
    }
  };

  // Informar que la transferencia fue realizada
  const handleReportTransfer = async (tripId) => {
    try {
      const res = await fetch(`/api/driver/trip/${tripId}/report-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', '¡Transferencia informada! Estado: Falta aprobación del Administrador.');
        if (lastClosedTrip && lastClosedTrip._id === tripId) {
          setLastClosedTrip(data.trip);
        }
        fetchMyTrips();
        fetchStats();
      } else {
        showNotification('error', data.message || 'Error al informar transferencia.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexión.');
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
            Bienvenido, <strong style={{ color: 'var(--text-primary)' }}>{currentUserName}</strong>. Registra tus viajes y gestiona tus rendiciones.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Tarjeta de Retención del Último Turno Cerrado */}
      {lastClosedTrip && lastClosedTrip.endMileage && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(245, 158, 11, 0.4)', background: 'linear-gradient(145deg, #111827 0%, #1e1b4b 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <div className="card-title" style={{ margin: 0, color: '#facc15' }}>
              <span>💰</span>
              <span>Liquidación y Retenciones del Turno ({new Date(lastClosedTrip.date).toLocaleDateString('es-AR')})</span>
            </div>
            <div>
              {lastClosedTrip.transferStatus === 'approved' ? (
                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
                  ✅ Transferencia Aprobada por Administrador
                </span>
              ) : lastClosedTrip.transferStatus === 'paid_pending_approval' ? (
                <span className="badge badge-warning" style={{ fontSize: '0.85rem' }}>
                  ⏳ Falta aprobación
                </span>
              ) : (
                <span className="badge badge-pending" style={{ fontSize: '0.85rem' }}>
                  ⚠️ Pendiente de transferencia
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ganancia Neta</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.netProfit || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.75rem', color: '#facc15', textTransform: 'uppercase' }}>🔧 Desgaste Auto (10%)</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#facc15', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.carWearAmount || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.75rem', color: '#fb923c', textTransform: 'uppercase' }}>🚘 Futuro Cambio Auto (10%)</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fb923c', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.carReplacementAmount || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '0.75rem', color: '#6ee7b7', textTransform: 'uppercase' }}>Total a Transferir (20%)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.totalTransferAmount || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Botón para marcar transferencia como realizada */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {lastClosedTrip.transferStatus === 'approved' ? (
                <span style={{ color: '#34d399' }}>El administrador ha confirmado la recepción de los fondos de este turno.</span>
              ) : lastClosedTrip.transferStatus === 'paid_pending_approval' ? (
                <span style={{ color: '#facc15' }}>Has informado la transferencia. Notificación enviada al administrador (Falta aprobación).</span>
              ) : (
                <span>Una vez realizada la transferencia bancaria por los <strong>${(lastClosedTrip.totalTransferAmount || 0).toFixed(2)}</strong>, presiona el botón para notificar al administrador.</span>
              )}
            </div>

            {lastClosedTrip.transferStatus === 'pending' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleReportTransfer(lastClosedTrip._id)}
                style={{ width: 'auto', padding: '0.65rem 1.25rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                ✔ Marcar transferencia como realizada
              </button>
            )}
          </div>
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
            Registra el fin de tu turno para calcular consumo, km, desgaste y transferencias.
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
              {loadingTrip ? 'Calculando...' : 'Cerrar Turno y Calcular Retenciones'}
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
          <div className="stat-card-label">Ganancia Neta</div>
          <div className="stat-card-value" style={{ color: '#34d399' }}>
            ${(stats.netProfit || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">Bruto - Nafta</div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(145deg, #111827 0%, #312e81 100%)' }}>
          <div className="stat-card-label" style={{ color: '#fbbf24' }}>Total Retenciones (20%)</div>
          <div className="stat-card-value" style={{ color: '#facc15' }}>
            ${(stats.totalTransfers || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub" style={{ color: '#fef08a' }}>10% Desgaste + 10% Cambio</div>
        </div>
      </div>

      {/* Historial de Turnos y Estado de Transferencias */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-title">
          <span>📋</span>
          <span>Historial de Turnos y Transferencias</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Revisa tus turnos, los importes a transferir y las modificaciones autorizadas.
        </p>

        {loadingTripsList ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Cargando turnos...</p>
        ) : myTrips.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No tienes turnos registrados aún.</p>
        ) : (
          <div className="table-container">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>KM Inicial / Final</th>
                  <th>Recaudado</th>
                  <th>Ganancia Neta</th>
                  <th>Desgaste (10%)</th>
                  <th>Cambio Auto (10%)</th>
                  <th>Total Transferir</th>
                  <th>Estado Transferencia</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {myTrips.map((t) => {
                  const isWearEdited = t.editedFields && (t.editedFields.includes('carWearAmount') || t.editedFields.includes('moneyObtained'));
                  const isReplacementEdited = t.editedFields && (t.editedFields.includes('carReplacementAmount') || t.editedFields.includes('moneyObtained'));
                  const isKmEdited = t.editedFields && (t.editedFields.includes('startMileage') || t.editedFields.includes('endMileage'));
                  const isMoneyEdited = t.editedFields && t.editedFields.includes('moneyObtained');

                  return (
                    <tr key={t._id} style={{ opacity: t.isCancelled ? 0.5 : 1 }}>
                      <td>
                        {new Date(t.date || t.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {t.isCancelled && <span className="badge badge-danger" style={{ marginLeft: '6px' }}>Anulado</span>}
                      </td>
                      <td>
                        <div className="info-field-wrapper">
                          <span>{t.startMileage} → {t.endMileage || 'En curso'}</span>
                          {isKmEdited && <InfoBadge text="Editado por administrador" />}
                        </div>
                      </td>
                      <td>
                        <div className="info-field-wrapper">
                          <span>${(t.moneyObtained || 0).toFixed(2)}</span>
                          {isMoneyEdited && <InfoBadge text="Editado por administrador" />}
                        </div>
                      </td>
                      <td style={{ color: '#38bdf8', fontWeight: 600 }}>
                        ${(t.netProfit || 0).toFixed(2)}
                      </td>
                      <td>
                        <div className="info-field-wrapper">
                          <span style={{ color: '#facc15' }}>${(t.carWearAmount || 0).toFixed(2)}</span>
                          {isWearEdited && <InfoBadge text="Editado por administrador" />}
                        </div>
                      </td>
                      <td>
                        <div className="info-field-wrapper">
                          <span style={{ color: '#fb923c' }}>${(t.carReplacementAmount || 0).toFixed(2)}</span>
                          {isReplacementEdited && <InfoBadge text="Editado por administrador" />}
                        </div>
                      </td>
                      <td style={{ color: '#34d399', fontWeight: 700 }}>
                        ${(t.totalTransferAmount || 0).toFixed(2)}
                      </td>
                      <td>
                        {t.transferStatus === 'approved' ? (
                          <span className="badge badge-success">Aprobada</span>
                        ) : t.transferStatus === 'paid_pending_approval' ? (
                          <span className="badge badge-warning">Falta aprobación</span>
                        ) : (
                          <span className="badge badge-pending">Pendiente</span>
                        )}
                      </td>
                      <td>
                        {t.transferStatus === 'pending' && t.endMileage && !t.isCancelled && (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleReportTransfer(t._id)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
                          >
                            Tildar Transferido
                          </button>
                        )}
                        {t.transferStatus === 'paid_pending_approval' && (
                          <span style={{ fontSize: '0.8rem', color: '#facc15' }}>En revisión</span>
                        )}
                        {t.transferStatus === 'approved' && (
                          <span style={{ fontSize: '0.8rem', color: '#34d399' }}>✓ Confirmado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverDashboard;