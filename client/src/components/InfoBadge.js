import React, { useState } from 'react';

function InfoBadge({ text = 'Editado por administrador' }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="info-field-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
      title="Información"
      style={{ marginLeft: '6px' }}
    >
      <span className="info-circle-badge">i</span>
      {showTooltip && (
        <span className="info-tooltip-popup">
          {text}
        </span>
      )}
    </span>
  );
}

export default InfoBadge;
