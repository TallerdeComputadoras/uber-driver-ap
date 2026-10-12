import React, { useState, useEffect, useCallback } from 'react';
import InfoBadge from './InfoBadge';
import FuelCalculator from './FuelCalculator';

function DriverDashboard({ token: propToken }) {
  const token = propToken || localStorage.getItem('token') || '';
  const currentUserId = localStorage.getItem('userId') || '';
  const currentUserName = localStorage.getItem('userName') || 'Conductor';

  // State for pre-trip form
  const [startFuelLevel, setStartFuelLevel] = useState('');

  // State for post-trip form
  const [kilometersDone, setKilometersDone] = useState('');
  const [endFuelLevel, setEndFuelLevel] = useState('');
  const [moneyObtained, setMoneyObtained] = useState('');
  const [fuelLitersAdded, setFuelLitersAdded] = useState('');

  // Notifications / feedback
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [lastClosedTrip, setLastClosedTrip] = useState(null);

  // Active open shift
  const [activeShift, setActiveShift] = useState(null);

  // Shifts history
  const [myTrips, setMyTrips] = useState([]);
  const [loadingTripsList, setLoadingTripsList] = useState(false);

  // Edit modal state
  const [editingTrip, setEditingTrip] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

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
        const trips = data.trips || [];
        setMyTrips(trips);
        // Detectar si hay una jornada abierta
        const open = trips.find((t) => !t.isFinished && !t.isCancelled);
        setActiveShift(open || null);
        // Si hay un turno recien finalizado sin transferir, guardarlo como ultimo turno
        const firstFinished = trips.find((t) => t.isFinished && !t.isCancelled);
        if (firstFinished && !lastClosedTrip) {
          setLastClosedTrip(firstFinished);
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

  // Handle pre-trip: Iniciar turno
  const handleStartTrip = async (e) => {
    e.preventDefault();
    if (startFuelLevel === '' || startFuelLevel === null || isNaN(Number(startFuelLevel))) {
      showNotification('error', 'Por favor ingresá el nivel de combustible del tanque (% o litros).');
      return;
    }
    setLoadingTrip(true);
    try {
      const body = { startFuelLevel: Number(startFuelLevel) };

      const res = await fetch('/api/driver/pre-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || 'Turno iniciado con exito. Buen viaje!');
        setStartFuelLevel('');
        fetchStats();
        fetchMyTrips();
      } else {
        showNotification('error', data.message || 'Error al iniciar turno.');
      }
    } catch (err) {
      showNotification('error', 'Error al conectar con el servidor.');
    } finally {
      setLoadingTrip(false);
    }
  };

  // Handle post-trip: Finalizar turno
  const handleEndTrip = async (e) => {
    e.preventDefault();
    if (moneyObtained === '') {
      showNotification('error', 'Por favor ingresa el dinero recaudado.');
      return;
    }
    setLoadingTrip(true);
    try {
      const body = { moneyObtained: Number(moneyObtained) };
      if (kilometersDone !== '') body.kilometersDone = Number(kilometersDone);
      if (endFuelLevel !== '') body.endFuelLevel = Number(endFuelLevel);
      if (fuelLitersAdded !== '') body.fuelLitersAdded = Number(fuelLitersAdded);

      const res = await fetch('/api/driver/post-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || 'Turno finalizado con exito.');
        setLastClosedTrip(data.trip);
        setKilometersDone('');
        setEndFuelLevel('');
        setMoneyObtained('');
        setFuelLitersAdded('');
        fetchStats();
        fetchMyTrips();
      } else {
        showNotification('error', data.message || 'Error al finalizar el turno.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexion con el servidor.');
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
        showNotification('success', 'Transferencia informada! Estado: Falta aprobacion del Administrador.');
        if (lastClosedTrip && lastClosedTrip._id === tripId) {
          setLastClosedTrip(data.trip);
        }
        fetchMyTrips();
        fetchStats();
      } else {
        showNotification('error', data.message || 'Error al informar transferencia.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexion.');
    }
  };

  // Eliminar una jornada
  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('Estas seguro de que queres eliminar esta jornada? Esta accion no se puede deshacer.')) return;
    try {
      const res = await fetch(`/api/driver/trip/${tripId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || 'Jornada eliminada.');
        if (lastClosedTrip && lastClosedTrip._id === tripId) setLastClosedTrip(null);
        fetchMyTrips();
        fetchStats();
      } else {
        showNotification('error', data.message || 'Error al eliminar.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexion.');
    }
  };

  // Abrir modal de edicion
  const handleOpenEdit = (trip) => {
    setEditingTrip(trip);
    setEditForm({
      kilometersDone: trip.kilometersDone ?? '',
      moneyObtained: trip.moneyObtained ?? '',
      startFuelLevel: trip.startFuelLevel ?? '',
      endFuelLevel: trip.endFuelLevel ?? '',
      fuelLitersAdded: trip.fuelLitersAdded ?? '',
    });
  };

  // Guardar edicion
  const handleSaveEdit = async () => {
    if (!editingTrip) return;
    setEditLoading(true);
    try {
      const body = {};
      if (editForm.kilometersDone !== '') body.kilometersDone = Number(editForm.kilometersDone);
      if (editForm.moneyObtained !== '') body.moneyObtained = Number(editForm.moneyObtained);
      if (editForm.startFuelLevel !== '') body.startFuelLevel = Number(editForm.startFuelLevel);
      if (editForm.endFuelLevel !== '') body.endFuelLevel = Number(editForm.endFuelLevel);
      if (editForm.fuelLitersAdded !== '') body.fuelLitersAdded = Number(editForm.fuelLitersAdded);

      const res = await fetch(`/api/driver/trip/${editingTrip._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || 'Jornada actualizada.');
        setEditingTrip(null);
        fetchMyTrips();
        fetchStats();
      } else {
        showNotification('error', data.message || 'Error al actualizar.');
      }
    } catch (err) {
      showNotification('error', 'Error de conexion.');
    } finally {
      setEditLoading(false);
    }
  };

  const periodLabels = {
    day: 'Hoy',
    week: 'Esta Semana',
    month: 'Este Mes',
    year: 'Este Ano',
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

      {/* Active shift banner */}
      {activeShift && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.3rem' }}>🟢</span>
          <div>
            <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>Jornada en curso</strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
              Iniciada el {new Date(activeShift.date || activeShift.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Tarjeta del Ultimo Turno Cerrado */}
      {lastClosedTrip && lastClosedTrip.isFinished && (lastClosedTrip.totalTransferAmount > 0 || lastClosedTrip.moneyObtained > 0) && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(245, 158, 11, 0.4)', background: 'linear-gradient(145deg, #111827 0%, #1e1b4b 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <div className="card-title" style={{ margin: 0, color: '#facc15' }}>
              <span>💰</span>
              <span>Ultimo Turno Cerrado ({new Date(lastClosedTrip.date).toLocaleDateString('es-AR')})</span>
            </div>
            <div>
              {lastClosedTrip.transferStatus === 'approved' ? (
                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
                  ✅ Transferencia Aprobada por Administrador
                </span>
              ) : lastClosedTrip.transferStatus === 'paid_pending_approval' ? (
                <span className="badge badge-warning" style={{ fontSize: '0.85rem' }}>
                  ⏳ Falta aprobacion
                </span>
              ) : (
                <span className="badge badge-pending" style={{ fontSize: '0.85rem' }}>
                  ⚠️ Pendiente de transferencia
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Dinero Recaudado</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.moneyObtained || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ganancia Neta</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.netProfit || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.72rem', color: '#facc15', textTransform: 'uppercase' }}>🔧 Desgaste (10%)</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#facc15', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.carWearAmount || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.72rem', color: '#fb923c', textTransform: 'uppercase' }}>🚘 Cambio Auto (10%)</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fb923c', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.carReplacementAmount || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '0.72rem', color: '#6ee7b7', textTransform: 'uppercase' }}>Total Transferir (20%)</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                ${(lastClosedTrip.totalTransferAmount || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {lastClosedTrip.transferStatus === 'approved' ? (
                <span style={{ color: '#34d399' }}>El administrador ha confirmado la recepcion de los fondos de este turno.</span>
              ) : lastClosedTrip.transferStatus === 'paid_pending_approval' ? (
                <span style={{ color: '#facc15' }}>Has informado la transferencia. Notificacion enviada al administrador (Falta aprobacion).</span>
              ) : (
                <span>Una vez realizada la transferencia bancaria por los <strong>${(lastClosedTrip.totalTransferAmount || 0).toFixed(2)}</strong>, presiona el boton para notificar al administrador.</span>
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
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        {/* Pre-trip Card */}
        <div className="card">
          <div className="card-title">
            <span style={{ fontSize: '1.4rem' }}>🟢</span>
            <span>Iniciar Jornada (Pre-Trip)</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Registra el inicio de tu jornada. Indicá el nivel de combustible del tanque para comenzar.
          </p>

          {activeShift ? (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#fbbf24' }}>
                🟡 Ya tenes una jornada abierta. Debes cerrarla antes de iniciar una nueva.
              </p>
            </div>
          ) : (
            <form onSubmit={handleStartTrip}>
              <div className="form-group">
                <label className="form-label">
                  Nivel de Combustible Inicial (% o Litros){' '}
                  <span style={{ color: '#f87171', fontSize: '0.75rem' }}>*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  placeholder="Ej: 80 (%)"
                  value={startFuelLevel}
                  onChange={(e) => setStartFuelLevel(e.target.value)}
                  required
                />
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#6ee7b7' }}>
                  ℹ️ Los kilometros realizados se ingresan al finalizar el turno, tomados directamente de las <strong>aplicaciones de conductores</strong>.
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loadingTrip}
                style={{ marginTop: '0.5rem', width: '100%', fontSize: '1.05rem', padding: '0.85rem' }}
              >
                {loadingTrip ? 'Iniciando...' : '🟢 Iniciar Turno'}
              </button>
            </form>
          )}
        </div>

        {/* Post-trip Card */}
        <div className="card">
          <div className="card-title">
            <span style={{ fontSize: '1.4rem' }}>🏁</span>
            <span>Finalizar Jornada (Post-Trip)</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Ingresa el dinero recaudado para cerrar el turno. Kms y combustible son opcionales.
          </p>
          <form onSubmit={handleEndTrip}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">
                  Dinero Recaudado ($) <span style={{ color: '#f87171', fontSize: '0.75rem' }}>*</span>
                </label>
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

              <div className="form-group">
                <label className="form-label">Kms segun apps — Opcional</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-input"
                  placeholder="Ej: 47.3"
                  value={kilometersDone}
                  onChange={(e) => setKilometersDone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Nivel Final Nafta (%) — Opcional</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  placeholder="Ej: 45 (%)"
                  value={endFuelLevel}
                  onChange={(e) => setEndFuelLevel(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nafta Cargada (Litros) — Opcional</label>
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
            </div>

            <button
              type="submit"
              className="btn-danger"
              disabled={loadingTrip}
              style={{ marginTop: '0.5rem', width: '100%', fontSize: '1.05rem', padding: '0.85rem' }}
            >
              {loadingTrip ? 'Cerrando...' : '🏁 Cerrar Turno'}
            </button>
          </form>
        </div>
      </div>

      {/* Calculadora de Consumo de Nafta — herramienta libre y opcional (colapsada por defecto) */}
      <FuelCalculator token={token} defaultOpen={false} />

      {/* Filter and Period Controls */}
      <div className="filter-bar">
        <div className="filter-item">
          <span className="filter-label">Periodo de Analisis:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="day">Dia actual</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="year">Este ano</option>
          </select>
        </div>
      </div>

      {/* KPI Stats Cards — sin Ingreso Bruto */}
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="stat-card-label">Turnos / Viajes</div>
          <div className="stat-card-value">{stats.tripCount}</div>
          <div className="stat-card-sub">{periodLabels[period]}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Kilometros Totales</div>
          <div className="stat-card-value">{(stats.totalKm || 0).toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>km</span></div>
          <div className="stat-card-sub">Distancia recorrida</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Ganancia Neta</div>
          <div className="stat-card-value" style={{ color: '#34d399' }}>
            ${(stats.netProfit || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">Recaudado - Nafta</div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(145deg, #111827 0%, #312e81 100%)' }}>
          <div className="stat-card-label" style={{ color: '#fbbf24' }}>Total Retenciones (20%)</div>
          <div className="stat-card-value" style={{ color: '#facc15' }}>
            ${(stats.totalTransfers || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub" style={{ color: '#fef08a' }}>10% Desgaste + 10% Cambio</div>
        </div>
      </div>

      {/* Historial de Jornadas */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-title">
          <span>📋</span>
          <span>Historial de Jornadas y Transferencias</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Revisa tus jornadas, los importes a transferir y realiza modificaciones antes de que sean aprobadas.
        </p>

        {loadingTripsList ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Cargando jornadas...</p>
        ) : myTrips.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No tenes jornadas registradas aun.</p>
        ) : (
          <div className="table-container">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>KM Apps</th>
                  <th>Recaudado</th>
                  <th>Ganancia Neta</th>
                  <th>Desgaste (10%)</th>
                  <th>Cambio Auto (10%)</th>
                  <th>Total Transferir</th>
                  <th>Transferencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {myTrips.map((t) => {
                  const isKmEdited = t.editedFields && (t.editedFields.includes('kilometersDone') || t.editedFields.includes('startMileage') || t.editedFields.includes('endMileage'));
                  const isMoneyEdited = t.editedFields && t.editedFields.includes('moneyObtained');
                  const isWearEdited = t.editedFields && (t.editedFields.includes('carWearAmount') || t.editedFields.includes('moneyObtained'));
                  const isReplacementEdited = t.editedFields && (t.editedFields.includes('carReplacementAmount') || t.editedFields.includes('moneyObtained'));
                  const canModify = t.transferStatus !== 'approved' && !t.isCancelled;

                  return (
                    <tr key={t._id} style={{ opacity: t.isCancelled ? 0.5 : 1 }}>
                      <td>
                        {new Date(t.date || t.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {t.isCancelled && <span className="badge badge-danger" style={{ marginLeft: '6px' }}>Anulado</span>}
                      </td>
                      <td>
                        {!t.isFinished && !t.isCancelled ? (
                          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>🟢 Abierta</span>
                        ) : (
                          <span className="badge badge-pending" style={{ fontSize: '0.75rem' }}>🏁 Cerrada</span>
                        )}
                      </td>
                      <td>
                        <div className="info-field-wrapper">
                          <span>
                            {t.kilometersDone !== undefined && t.kilometersDone !== null && t.kilometersDone > 0
                              ? `${t.kilometersDone} km`
                              : (t.startMileage ? `${t.startMileage} → ${t.endMileage || 'En curso'}` : '—')}
                          </span>
                          {isKmEdited && <InfoBadge text="Editado por administrador" />}
                        </div>
                      </td>
                      <td>
                        <div className="info-field-wrapper">
                          <span>${(t.moneyObtained || 0).toFixed(2)}</span>
                          {isMoneyEdited && <InfoBadge text="Editado por administrador" />}
                        </div>
                      </td>
                      <td style={{ color: '#34d399', fontWeight: 600 }}>
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
                          <span className="badge badge-warning">Falta aprobacion</span>
                        ) : (
                          <span className="badge badge-pending">Pendiente</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {t.transferStatus === 'pending' && t.isFinished && !t.isCancelled && (t.moneyObtained > 0 || t.totalTransferAmount > 0) && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleReportTransfer(t._id)}
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem', width: 'auto' }}
                            >
                              Tildar Transferido
                            </button>
                          )}
                          {t.transferStatus === 'paid_pending_approval' && (
                            <span style={{ fontSize: '0.8rem', color: '#facc15' }}>En revision</span>
                          )}
                          {t.transferStatus === 'approved' && (
                            <span style={{ fontSize: '0.8rem', color: '#34d399' }}>✔ Confirmado</span>
                          )}
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t)}
                              style={{
                                padding: '0.3rem 0.55rem', fontSize: '0.72rem', width: 'auto',
                                background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)',
                                color: '#38bdf8', borderRadius: '6px', cursor: 'pointer',
                              }}
                            >
                              ✏️ Editar
                            </button>
                          )}
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTrip(t._id)}
                              style={{
                                padding: '0.3rem 0.55rem', fontSize: '0.72rem', width: 'auto',
                                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171', borderRadius: '6px', cursor: 'pointer',
                              }}
                            >
                              🗑 Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edicion */}
      {editingTrip && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
            padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', fontWeight: 700 }}>
              ✏️ Editar Jornada — {new Date(editingTrip.date || editingTrip.createdAt).toLocaleDateString('es-AR')}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Dinero Recaudado ($)</label>
                <input type="number" step="0.01" min="0" className="form-input"
                  value={editForm.moneyObtained}
                  onChange={(e) => setEditForm({ ...editForm, moneyObtained: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kms segun apps</label>
                <input type="number" step="0.1" min="0" className="form-input"
                  value={editForm.kilometersDone}
                  onChange={(e) => setEditForm({ ...editForm, kilometersDone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nafta Inicial (%)</label>
                <input type="number" step="1" min="0" className="form-input"
                  value={editForm.startFuelLevel}
                  onChange={(e) => setEditForm({ ...editForm, startFuelLevel: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nafta Final (%)</label>
                <input type="number" step="1" min="0" className="form-input"
                  value={editForm.endFuelLevel}
                  onChange={(e) => setEditForm({ ...editForm, endFuelLevel: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Nafta Cargada (Litros)</label>
                <input type="number" step="0.1" min="0" className="form-input"
                  value={editForm.fuelLitersAdded}
                  onChange={(e) => setEditForm({ ...editForm, fuelLitersAdded: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveEdit}
                disabled={editLoading}
                style={{ flex: 1 }}
              >
                {editLoading ? 'Guardando...' : '💾 Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;