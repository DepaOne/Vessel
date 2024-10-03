import React from 'react';

function SliderWithInput({ id, label, min, max, step = 1, value, onChange }) {
  return (
    <div className="slider-with-input">
      <label htmlFor={id}>{label}</label>
      <div className="input-group">
        <input
          type="range"
          id={`${id}-slider`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <input
          type="number"
          id={`${id}-input`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}

export default SliderWithInput;