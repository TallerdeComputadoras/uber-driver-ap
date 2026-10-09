import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

function DriverDashboard() {
  const navigate = useNavigate();
  const [token] = localStorage.getItem('token') ? localStorage.getItem('token') : '';
  const driverId = localStorage.getItem('userId') || undefined;

  // State for pre-trip form
  const [startMileage, setStartMileage] = useState('');
  const [startFuelLevel, setStartFuelLevel] = useState('');

  // State for post-trip form (within a trip context)
  const [endMileage, setEndMileage] = useState('');
  const [endFuelLevel, setEndFuelLevel] = useState('');
  const [fuelLitersAdded, setFuelLitersAdded] = useState('');
  const [moneyObtained, setMoneyObtained] = useState('');

  // State for stats
  const [drivers, setDrivers] = useState([]); // list of drivers from backend
  const [selectedDriverId, setSelectedDriverId] = useState(driverId); // default to current user
  const [period, setPeriod] = useState('month'); // day, week, month, year
  const [stats, setStats] = useState({
    tripCount: 0,
    totalKm: 0,
    totalMoney: 0,
    totalFuelCost: 0,
    loading: true,
  });

  // Fetch all drivers (for dropdown) - admin or driver can see any
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = await res.json();
        // If admin, fetch all drivers; if driver, also can see others per requirement
        let driversRes;
        if (user.role === 'admin') {
          driversRes = await fetch('/api/admin/drivers-stats?period=month', {
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          // Driver can see others; fetch a simple list
          driversRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        const d = await driversRes.json();
        // d might be the user info or stats; let's just set drivers from a separate endpoint or use what we have
        // For now, we'll set drivers from the user's info and maybe a hardcoded list or fetch /api/users if exists
        // Since we don't have a list endpoint, we'll use the current user and maybe allow input of driver ID
        setDrivers([{ _id: user._id || driverId, name: user.name || 'Yo' }]);
        setSelectedDriverId(user._id || driverId);
      } catch (err) {
        console.error('Error fetching drivers:', err);
        // Default to current user if token invalid
        setDrivers([{ _id: driverId || '1', name: 'Yo' }]);
        setSelectedDriverId(driverId || '1');
      }
    };
    if (token) fetchDrivers();
  }, [token, driverId]);

  // Fetch stats based on selected driver and period
  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        const res = await fetch(`/api/driver/stats?driverId=${selectedDriverId}&period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setStats({
          tripCount: data.tripCount || 0,
          totalKm: data.totalKilometers || 0,
          totalMoney: data.totalMoneyObtained || 0,
          totalFuelCost: data.totalFuelCost || 0,
          loading: false,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        setStats({ tripCount: 0, totalKm: 0, totalMoney: 0, totalFuelCost: 0, loading: false });
      }
    };
    fetchStats();
  }, [selectedDriverId, period, token]);

  // Handle pre-trip submission
  const handleStartTrip = async (e) => {
    e.preventDefault();
    if (!startMileage || !startFuelLevel) {
      alert('Por favor ingresa el kilometraje y nivel de nafta al iniciar');
      return;
    }
    try {
      const res = await fetch('/api/driver/pre-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startMileage: Number(startMileage), startFuelLevel: Number(startFuelLevel) }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setStartMileage('');
        setStartFuelLevel('');
        // Refresh stats
        // We'll just re-fetch stats below; but for simplicity, navigate back or reload
        // Actually, we can just update state or alert; the user will see updated stats
      } else {
        alert(data.message || 'Error al guardar inicio de viaje');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // Handle post-trip submission
  const handleEndTrip = async (e) => {
    e.preventDefault();
    if (!endMileage || !endFuelLevel || moneyObtained === '') {
      alert('Por favor completa todos los campos para finalizar el viaje');
      return;
    }
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
          moneyObtained: Number(moneyObtained) 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setEndMileage('');
        setEndFuelLevel('');
        setFuelLitersAdded('');
        setMoneyObtained('');
        // Refresh stats
      } else {
        alert(data.message || 'Error al finalizar viaje');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Panel de Chofer</h2>
      
      {/* Pre-trip form */}
      <div style={{ background: '#f8f9fa', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
        <h3>Iniciar Jornada (Pre-trip)</h3>
        <form onSubmit={handleStartTrip}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Kilometraje inicial</label>
            <input
              type="number"
              value={startMileage}
              onChange={(e) => setStartMileage(e.target.value)}
              min="0"
              step="0.1"
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Nivel de nafta inicial (% o litros)</label>
            <input
              type="number"
              value={startFuelLevel}
              onChange={(e) => setStartFuelLevel(e.target.value)}
              min="0"
              max="100"
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <button type="submit" style={{ padding: '0.5rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Guardar inicio de jornada
          </button>
        </form>
      </div>

      {/* Post-trip form */}
      <div style={{ background: '#f8f9fa', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
        <h3>Finalizar Jornada (Post-trip)</h3>
        <form onSubmit={handleEndTrip}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Kilometraje final</label>
            <input
              type="number"
              value={endMileage}
              onChange={(e) => setEndMileage(e.target.value)}
              min="0"
              step="0.1"
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Nivel de nafta final (% o litros)</label>
            <input
              type="number"
              value={endFuelLevel}
              onChange={(e) => setEndFuelLevel(e.target.value)}
              min="0"
              max="100"
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Nafta cargada (litros, 0 si no cargó)</label>
            <input
              type="number"
              value={fuelLitersAdded}
              onChange={(e) => setFuelLitersAdded(e.target.value)}
              min="0"
              step="0.1"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Dinero obtenido</label>
            <input
              type="number"
              value={moneyObtained}
              onChange={(e) => setMoneyObtained(e.target.value)}
              min="0"
              step="0.01"
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <button type="submit" style={{ padding: '0.5rem 1rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Guardar fin de jornada
          </button>
        </form>
      </div>

      {/* Stats & Dashboard section */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Estadísticas</h3>
        
        {/* Driver selector - any driver can view any */}
        <div style={{ marginBottom: '1rem' }}>
          <label>Ver estadísticas de:</label>
          <select
            style={{ padding: '0.5rem', marginRight: '0.5rem' }}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            defaultValue={selectedDriverId}
          >
            {drivers.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period selector */}
        <div style={{ marginBottom: '1rem' }}>
          <label>Período:</label>
          <select
            style={{ padding: '0.5rem' }}
            onChange={(e) => setPeriod(e.target.value)}
            defaultValue={period}
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: '#e9ecef', padding: '1rem', borderRadius: '4px' }}>
            <div>Viajes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.tripCount}</div>
          </div>
          <div style={{ background: '#e9ecef', padding: '1rem', borderRadius: '4px' }}>
            <div>Kilómetros</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.totalKm.toFixed(2)} km</div>
          </div>
          <div style={{ background: '#e9ecef', padding: '1rem', borderRadius: '4px' }}>
            <div>Dinero obtenido</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }>${stats.totalMoney.toFixed(2)}</div>
          </div>
          <div style={{ background: '#e9ecef', padding: '1rem', borderRadius: '4px' }}>
            <div>Costo combustible</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }>${stats.totalFuelCost.toFixed(2)}</div>
          </div>
        </div>

        {/* Pie chart - fuel cost distribution or money usage */}
        <div style={{ background: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #dee2e6' }}>
          <h4>Distribución de gastos (Gráfica)</h4>
          <canvas id="statsChart" width="400" height="200" style={{ width: '100%', height: '200px' }}></canvas>
          <script>
            // Simple chart using Chart.js if available, or just note
            const ctx = document.getElementById('statsChart').getContext('2d');
            new Chart(ctx, {
              type: 'pie',
              data: {
                labels: ['Kilómetros', 'Combustible', 'Otros'],
                datasets: [{
                  label: 'Estadísticas del conductor',
                  data: [stats.totalKm || 1, stats.totalFuelCost || 1, stats.totalMoney || 1],
                  backgroundColor: ['#4e73df', '#f6c4b6', '#59a14f'],
                }],
              },
              options: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Distribución de recursos' },
              },
            });
          </script>
        </div>
      </div>
    </div>
  );
}

export default DriverDashboard;