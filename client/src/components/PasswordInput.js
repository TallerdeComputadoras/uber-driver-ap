import React, { useState } from 'react';

function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = '••••••••••••',
  required = false,
  autoComplete = 'current-password',
  className = 'form-input',
  disabled = false,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={className}
        disabled={disabled}
      />
      <button
        type="button"
        className="btn-eye-toggle"
        onClick={() => setShowPassword((prev) => !prev)}
        title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña ingresada'}
        tabIndex="-1"
      >
        {showPassword ? (
          <span role="img" aria-label="ocultar" style={{ fontSize: '1.05rem' }}>
            🙈
          </span>
        ) : (
          <span role="img" aria-label="ver" style={{ fontSize: '1.05rem' }}>
            👁️
          </span>
        )}
      </button>
    </div>
  );
}

export default PasswordInput;
