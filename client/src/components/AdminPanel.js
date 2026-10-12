import React, { useState, useEffect, useCallback } from 'react';
import PasswordInput from './PasswordInput';
import FuelCalculator from './FuelCalculator';

function AdminPanel({ token: propToken }) {
  const [token, setToken] = useState(propToken || localStorage.getItem('token') || '');
  const [userRole] = useState(localStorage.getItem('userRole') || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(userRole === 'admin');

  // Tabs: 'drivers' | 'trips' | 'config'
  const [activeTab, setActiveTab] = useState('trips');

  // Fuel price state
  const [currentFuelPrice, setCurrentFuelPrice] = useState(null);
  const [fuelPriceInput, setFuelPriceInput] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // Users state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Trips state
  const [tripsList, setTripsList] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [filterTransferStatus, setFilterTransferStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('month');

  // Edit Trip Modal
  const [editingTrip, setEditingTrip] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingTripEdit, setSavingTripEdit] = useState(false);

  // Rendition & drivers state
  const [driversStats, setDriversStats] = useState([]);
  const [selectedDriverForRendition, setSelectedDriverForRendition] = useState('');

  // Alerts
  const [alert, setAlert] = useState({ type: '', message: '' });

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 5000);
  };

  // Fetch fuel price
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

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  // Fetch trips list
  const fetchTrips = useCallback(async () => {
    if (!token) return;
    setLoadingTrips(true);
    try {
      const url = `/api/admin/trips?period=${filterPeriod}${filterTransferStatus !== 'all' ? `&transferStatus=${filterTransferStatus}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTripsList(data.trips || []);
      }
    } catch (err) {
      console.error('Error fetching trips:', err);
    } finally {
      setLoadingTrips(false);
    }
  }, [token, filterPeriod, filterTransferStatus]);

  // Fetch drivers stats
  const fetchDriversStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/drivers-stats?period=${filterPeriod}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDriversStats(data.drivers || []);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  }, [token, filterPeriod]);

  useEffect(() => {
    fetchCurrentFuelPrice();
  }, []);

  useEffect(() => {
    if (isAuthenticatedAdmin && token) {
      fetchTrips();
      fetchUsers();
      fetchDriversStats();
    }
  }, [isAuthenticatedAdmin, token, fetchTrips, fetchUsers, fetchDriversStats]);

  // Admin authentication
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
        showAlert('success', 'Panel de Administrador desbloqueado.');
      } else {
        showAlert('error', data.message || 'Contrasena de administrador incorrecta.');
      }
    } catch (err) {
      showAlert('error', 'Error al conectar con el servidor.');
    }
  };

  // Update fuel price
  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    if (!fuelPriceInput || isNaN(Number(fuelPriceInput)) || Number(fuelPriceInput) <= 0) {
      showAlert('error', 'Por favor ingresa un precio de nafta valido.');
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

  // Aprobar transferencia de un turno
  const handleApproveTransfer = async (tripId) => {
    try {
      const res = await fetch(`/api/admin/trip/${tripId}/approve-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', 'Transferencia confirmada y aprobada.');
        fetchTrips();
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al aprobar transferencia.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Dar de baja a un usuario
  const handleDeactivateUser = async (userId, userName) => {
    if (!window.confirm(`¿Estas seguro de dar de baja al usuario "${userName}"? No podra volver a iniciar sesion, pero su historial quedara guardado.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/user/${userId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', data.message || 'Usuario dado de baja.');
        fetchUsers();
      } else {
        showAlert('error', data.message || 'Error al dar de baja usuario.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Reactivar usuario
  const handleActivateUser = async (userId) => {
    try {
      const res = await fetch(`/api/admin/user/${userId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', data.message || 'Usuario reactivado.');
        fetchUsers();
      } else {
        showAlert('error', data.message || 'Error al reactivar usuario.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Eliminar definitivamente un usuario (debe haber sido dado de baja primero)
  const handleDeleteUser = async (user) => {
    if (user.isActive) {
      showAlert('error', 'Para eliminar un usuario, primero debe ser dado de baja.');
      return;
    }
    if (!window.confirm(`⚠️ ADVERTENCIA CRITICA: ¿Eliminar definitivamente a "${user.name}"? Desaparecera todo rastro del usuario y todos sus turnos asociados. Esta accion NO se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/user/${user._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', data.message || 'Usuario eliminado definitivamente.');
        fetchUsers();
        fetchTrips();
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al eliminar usuario.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Abrir modal de edición de turno
  const handleOpenEditTrip = (trip) => {
    setEditingTrip(trip);
    setEditFormData({
      kilometersDone: trip.kilometersDone !== undefined && trip.kilometersDone !== null ? trip.kilometersDone : '',
      startMileage: trip.startMileage || '',
      endMileage: trip.endMileage || '',
      startFuelLevel: trip.startFuelLevel || '',
      endFuelLevel: trip.endFuelLevel || '',
      fuelLitersAdded: trip.fuelLitersAdded || 0,
      moneyObtained: trip.moneyObtained || 0,
      transferStatus: trip.transferStatus || 'pending',
      isCancelled: trip.isCancelled || false,
      adminNotes: trip.adminNotes || '',
    });
  };

  // Guardar edición de turno
  const handleSaveTripEdit = async (e) => {
    e.preventDefault();
    if (!editingTrip) return;
    setSavingTripEdit(true);

    try {
      const res = await fetch(`/api/admin/trip/${editingTrip._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', 'Turno actualizado por el administrador.');
        setEditingTrip(null);
        fetchTrips();
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al actualizar turno.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    } finally {
      setSavingTripEdit(false);
    }
  };

  // Toggle cancelación de turno
  const handleToggleCancelTrip = async (tripId) => {
    try {
      const res = await fetch(`/api/admin/trip/${tripId}/toggle-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', data.message || 'Estado del turno actualizado.');
        fetchTrips();
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al modificar turno.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Eliminar definitivamente una jornada (solo admin)
  const handleDeleteTrip = async (t) => {
    if (!window.confirm(`⚠️ ¿Eliminar DEFINITIVAMENTE esta jornada de "${t.driver?.name || 'conductor'}"? Esta acción NO se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/trip/${t._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', 'Jornada eliminada definitivamente.');
        fetchTrips();
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al eliminar jornada.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  // Marcar rendición mensual como abonada
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
        showAlert('success', data.message || 'Rendición mensual marcada como abonada exitosamente.');
        setSelectedDriverForRendition('');
        fetchTrips();
        fetchDriversStats();
      } else {
        showAlert('error', data.message || 'Error al marcar rendición.');
      }
    } catch (err) {
      showAlert('error', 'Error de conexión.');
    }
  };

  if (!isAuthenticatedAdmin) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">Panel de Administracion</h1>
          <p className="auth-subtitle">Ingresa la clave maestra para acceder</p>
        </div>

        {alert.message && (
          <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
            <span>{alert.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{alert.message}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label className="form-label">Contrasena de Administrador</label>
            <PasswordInput
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Ingresa la contrasena"
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '0.75rem' }}>
            Desbloquear Panel
          </button>
        </form>
      </div>
    );
  }

  // Contadores rápidos
  const pendingTransfersTotal = tripsList.filter((t) => t.transferStatus === 'paid_pending_approval').length;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Centro de Control Administrador
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Supervision de turnos, confirmacion de transferencias y gestion de usuarios.
          </p>
        </div>
      </div>

      {alert.message && (
        <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{alert.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{alert.message}</span>
        </div>
      )}

      {/* Navegación por pestañas */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.75rem', overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setActiveTab('trips')}
          style={{
            padding: '0.75rem 1.25rem',
            background: activeTab === 'trips' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'trips' ? 'var(--accent)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'trips' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🚗 Turnos y Transferencias</span>
          {pendingTransfersTotal > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
              {pendingTransfersTotal} por aprobar
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drivers')}
          style={{
            padding: '0.75rem 1.25rem',
            background: activeTab === 'drivers' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'drivers' ? 'var(--accent)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'drivers' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          👥 Gestión de Usuarios
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          style={{
            padding: '0.75rem 1.25rem',
            background: activeTab === 'config' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'config' ? 'var(--accent)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'config' ? '2px solid var(--accent)' : '2px solid transparent',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          ⚙️ Nafta y Rendición
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: TURNOS Y TRANSFERENCIAS                        */}
      {/* ========================================================= */}
      {activeTab === 'trips' && (
        <div>
          {/* Calculadora interactiva de consumo de nafta para el administrador */}
          <FuelCalculator
            isAdmin={true}
            defaultOpen={true}
            token={token}
            onPriceUpdated={(newPrice) => {
              setCurrentFuelPrice(newPrice);
              fetchTrips();
            }}
          />

          {/* Filtros */}
          <div className="filter-bar">
            <div className="filter-item">
              <span className="filter-label">Estado Transferencia:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.45rem 0.85rem' }}
                value={filterTransferStatus}
                onChange={(e) => setFilterTransferStatus(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="paid_pending_approval">⏳ Falta aprobación</option>
                <option value="approved">✅ Aprobadas</option>
                <option value="pending">⚠️ Pendiente de chofer</option>
              </select>
            </div>

            <div className="filter-item">
              <span className="filter-label">Periodo:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.45rem 0.85rem' }}
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="year">Ano</option>
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>📋</span>
              <span>Listado de Turnos y Aprobacion de Fondos</span>
            </div>

            {loadingTrips ? (
              <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Cargando turnos...</p>
            ) : tripsList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No hay turnos con los filtros seleccionados.</p>
            ) : (
              <div className="table-container">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>Conductor</th>
                      <th>Fecha</th>
                      <th>KM Apps</th>
                      <th>Recaudado</th>
                      <th>Ganancia Neta</th>
                      <th>Desgaste (10%)</th>
                      <th>Cambio Auto (10%)</th>
                      <th>Total Transferencia</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripsList.map((t) => (
                      <tr key={t._id} style={{ opacity: t.isCancelled ? 0.45 : 1 }}>
                        <td>
                          <strong>{t.driver?.name || 'Chofer'}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.driver?.email}</div>
                          {t.isCancelled && <span className="badge badge-danger" style={{ marginTop: '3px' }}>Turno Anulado</span>}
                          {t.editedByAdmin && <span className="badge badge-info" style={{ marginTop: '3px', marginLeft: '3px' }}>Editado por Admin</span>}
                        </td>
                        <td>{new Date(t.date || t.createdAt).toLocaleDateString('es-AR')}</td>
                        <td>
                          {t.kilometersDone !== undefined && t.kilometersDone !== null
                            ? `${t.kilometersDone} km`
                            : (t.startMileage ? `${t.startMileage} → ${t.endMileage || 'En curso'}` : 'En curso')}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {(t.fuelConsumedLiters || 0).toFixed(1)} L nafta
                          </div>
                        </td>
                        <td>${(t.moneyObtained || 0).toFixed(2)}</td>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>${(t.netProfit || 0).toFixed(2)}</td>
                        <td style={{ color: '#facc15' }}>${(t.carWearAmount || 0).toFixed(2)}</td>
                        <td style={{ color: '#fb923c' }}>${(t.carReplacementAmount || 0).toFixed(2)}</td>
                        <td style={{ color: '#34d399', fontWeight: 700 }}>${(t.totalTransferAmount || 0).toFixed(2)}</td>
                        <td>
                          {t.transferStatus === 'approved' ? (
                            <span className="badge badge-success">Aprobada</span>
                          ) : t.transferStatus === 'paid_pending_approval' ? (
                            <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                              ⏳ Falta aprobación
                            </span>
                          ) : (
                            <span className="badge badge-pending">Pendiente</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {t.transferStatus === 'paid_pending_approval' && (
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleApproveTransfer(t._id)}
                                title="Confirmar que la transferencia fue realizada y recibida"
                                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: '#10b981' }}
                              >
                                ✔ Confirmar
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleOpenEditTrip(t)}
                              title="Editar datos del turno"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleToggleCancelTrip(t._id)}
                              title={t.isCancelled ? 'Reactivar turno' : 'Dar de baja este turno'}
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.75rem',
                                color: t.isCancelled ? '#34d399' : '#f87171',
                              }}
                            >
                              {t.isCancelled ? 'Reactivar' : 'Anular'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleDeleteTrip(t)}
                              title="Eliminar definitivamente esta jornada"
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.75rem',
                                color: '#ef4444',
                                borderColor: '#ef4444',
                              }}
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: GESTIÓN DE USUARIOS                            */}
      {/* ========================================================= */}
      {activeTab === 'drivers' && (
        <div className="card">
          <div className="card-title">
            <span>👥</span>
            <span>Gestión de Choferes y Usuarios</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Los usuarios <strong>dados de baja</strong> no pueden iniciar sesión pero su historial queda guardado. Para eliminar definitivamente un usuario y borrar todo su rastro, debe ser dado de baja primero.
          </p>

          {loadingUsers ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>Cargando usuarios...</p>
          ) : (
            <div className="table-container">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Turnos Realizados</th>
                    <th>Transferencias por Aprobar</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.65 }}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-pending'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="badge badge-success">Activo</span>
                        ) : (
                          <span className="badge badge-danger">
                            Dado de baja {u.deactivatedAt && `(${new Date(u.deactivatedAt).toLocaleDateString('es-AR')})`}
                          </span>
                        )}
                      </td>
                      <td>{u.tripsCount || 0}</td>
                      <td>
                        {u.pendingTransfers > 0 ? (
                          <span className="badge badge-warning">{u.pendingTransfers}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td>
                        {u.role !== 'admin' && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {u.isActive ? (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDeactivateUser(u._id, u.name)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  color: '#fbbf24',
                                  borderColor: 'rgba(245, 158, 11, 0.4)',
                                }}
                              >
                                Dar de baja
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleActivateUser(u._id)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  color: '#34d399',
                                  borderColor: 'rgba(16, 185, 129, 0.4)',
                                }}
                              >
                                Reactivar
                              </button>
                            )}

                            {/* Botón de eliminar definitivamente: SOLO si fue dado de baja */}
                            {u.isActive ? (
                              <button
                                type="button"
                                disabled
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'not-allowed',
                                }}
                                title="Para eliminar primero debe ser dado de baja"
                              >
                                Eliminar (baja previa requerida)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.5)',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                }}
                              >
                                🗑️ Eliminar definitivamente
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: COMBUSTIBLE Y RENDICIÓN                        */}
      {/* ========================================================= */}
      {activeTab === 'config' && (
        <div>
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
                    placeholder="Ej: 1100.50"
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
                Marca la rendición del mes correspondiente como liquidada y aprueba sus transferencias pendientes.
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
                        {d.name} (${(d.totalMoney || 0).toFixed(2)} recaudados | {d.pendingTransfers} por aprobar)
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
        </div>
      )}

      {/* Modal para Editar Turno (Administrador) */}
      {editingTrip && (
        <div className="modal-overlay" onClick={() => setEditingTrip(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                ✏️ Editar Turno ({editingTrip.driver?.name})
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingTrip(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Al modificar cualquier dato, el chofer verá una <strong>"i" en círculo pequeña</strong> sobre el campo con el mensaje <em>"Editado por administrador"</em>.
            </p>

            <form onSubmit={handleSaveTripEdit}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>
                  Kilómetros Realizados según Apps de Conductores (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-input"
                  placeholder="Ej: 47.3"
                  value={editFormData.kilometersDone}
                  onChange={(e) => setEditFormData({ ...editFormData, kilometersDone: e.target.value })}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Al guardar, se recalcula el consumo a 10L/100km (kms ÷ 10), ganancia neta y retenciones (10% + 10%).
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Dinero Recaudado ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editFormData.moneyObtained}
                    onChange={(e) => setEditFormData({ ...editFormData, moneyObtained: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nafta Cargada (Litros)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={editFormData.fuelLitersAdded}
                    onChange={(e) => setEditFormData({ ...editFormData, fuelLitersAdded: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Nafta Inicial (% o Litros)</label>
                  <input
                    type="number"
                    step="1"
                    className="form-input"
                    value={editFormData.startFuelLevel}
                    onChange={(e) => setEditFormData({ ...editFormData, startFuelLevel: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nafta Final (% o Litros)</label>
                  <input
                    type="number"
                    step="1"
                    className="form-input"
                    value={editFormData.endFuelLevel}
                    onChange={(e) => setEditFormData({ ...editFormData, endFuelLevel: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Odómetro Inicial (km - opcional)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={editFormData.startMileage}
                    onChange={(e) => setEditFormData({ ...editFormData, startMileage: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Odómetro Final (km - opcional)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={editFormData.endMileage}
                    onChange={(e) => setEditFormData({ ...editFormData, endMileage: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Estado de la Transferencia</label>
                <select
                  className="form-select"
                  value={editFormData.transferStatus}
                  onChange={(e) => setEditFormData({ ...editFormData, transferStatus: e.target.value })}
                >
                  <option value="pending">⚠️ Pendiente de chofer</option>
                  <option value="paid_pending_approval">⏳ Falta aprobación</option>
                  <option value="approved">✅ Aprobada por Administrador</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notas del Administrador (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Corregido kilometraje por ticket de peaje"
                  value={editFormData.adminNotes}
                  onChange={(e) => setEditFormData({ ...editFormData, adminNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingTrip(null)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingTripEdit}
                  style={{ flex: 1.5 }}
                >
                  {savingTripEdit ? 'Guardando...' : 'Guardar y Recalcular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;