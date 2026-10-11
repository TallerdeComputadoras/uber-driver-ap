import React, { useState, useEffect } from 'react';

function FuelCalculator({ isAdmin = false, token = '', onPriceUpdated }) {
  const [fuelPrice, setFuelPrice] = useState('');
  const [kilometers, setKilometers] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Fetch current official fuel price on mount
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/admin/fuel-price');
        if (res.ok) {
          const data = await res.json();
          if (data.pricePerLiter) {
            setFuelPrice(data.pricePerLiter.toString());
          }
        }
      } catch (err) {
        console.error('Error fetching fuel price for calculator:', err);
      }
    };
    fetchPrice();
  }, []);

  // Parse numerical values
  const priceNum = parseFloat(fuelPrice) || 0;
  const kmNum = parseFloat(kilometers) || 0;

  // Fórmula oficial según captura: 10 Litros cada 100 km -> Litros = (10 * km) / 100 = km / 10
  const litersConsumed = kmNum > 0 ? kmNum / 10 : 0;
  const moneySpent = litersConsumed * priceNum;

  // Handler for admin to persist the edited price as official system price
  const handleSaveOfficialPrice = async () => {
    if (!isAdmin || !token || priceNum <= 0) return;
    setSavingPrice(true);
    setSaveSuccess('');
    try {
      const res = await fetch('/api/admin/fuel-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pricePerLiter: priceNum }),
      });
      if (res.ok) {
        setSaveSuccess('¡Precio oficial de nafta actualizado en el sistema!');
        setTimeout(() => setSaveSuccess(''), 4000);
        if (onPriceUpdated) onPriceUpdated(priceNum);
      }
    } catch (err) {
      console.error('Error saving official fuel price:', err);
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <div
      className="card fuel-calc-card"
      style={{
        border: '1px solid rgba(56, 189, 248, 0.35)',
        background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
        marginBottom: '2rem',
        boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.15)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div className="card-title" style={{ margin: 0, color: '#38bdf8' }}>
          <span style={{ fontSize: '1.4rem' }}>⛽</span>
          <span>Calculadora de Consumo de Nafta</span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontWeight: 600,
          }}
        >
          Tasa fija: 10 L cada 100 km (kms ÷ 10)
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Calcula al instante los litros de nafta consumidos y el costo total en combustible.
        Ingresa o edita el precio de la <strong>Nafta Premium por 1L</strong> y la distancia recorrida en kilómetros.
      </p>

      {saveSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.5rem 0.85rem' }}>
          <span>✅</span>
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Grid de Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Input 1: Precio Nafta Premium */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Precio Nafta Premium x 1L ($)</span>
            {isAdmin && <span style={{ color: '#38bdf8', fontSize: '0.75rem' }}>Editable</span>}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              placeholder="Ej: 1150.00"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(e.target.value)}
              style={{ fontSize: '1.05rem', fontWeight: 600 }}
            />
            {isAdmin && (
              <button
                type="button"
                onClick={handleSaveOfficialPrice}
                disabled={savingPrice || priceNum <= 0}
                className="btn-secondary"
                title="Guardar este precio como oficial del sistema"
                style={{
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.78rem',
                  whiteSpace: 'nowrap',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                }}
              >
                {savingPrice ? '...' : 'Guardar Global'}
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Puedes modificar este precio libremente para simular distintos importes.
          </span>
        </div>

        {/* Input 2: Kilómetros recorridos */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            Kilómetros realizados (km)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="form-input"
            placeholder="Ej: 47.3"
            value={kilometers}
            onChange={(e) => setKilometers(e.target.value)}
            style={{ fontSize: '1.05rem', fontWeight: 600 }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Distancia indicada por las aplicaciones de conductores.
          </span>
        </div>
      </div>

      {/* Resultados Calculados en Tiempo Real */}
      <div
        style={{
          marginTop: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {/* Resultado: Litros Consumidos */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Litros Consumidos
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {litersConsumed.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Lts</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {kmNum > 0 ? `(${kmNum} km ÷ 10)` : 'Tasa: 10 L / 100 km'}
          </div>
        </div>

        {/* Resultado: Dinero Gastado en Combustible */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dinero Gastado en Nafta
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
            ${moneySpent.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {litersConsumed > 0 && priceNum > 0
              ? `${litersConsumed.toFixed(2)} L × $${priceNum.toFixed(2)}`
              : 'Litros consumidos × Precio x 1L'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FuelCalculator;
