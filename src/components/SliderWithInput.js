import React from 'react';

const SliderWithInput = ({ id, label, min, max, step = 1, value, onChange }) => {
  const handleSliderChange = (e) => {
    const newValue = parseFloat(e.target.value);
    onChange(Number(newValue.toFixed(2)));
  };

  const handleInputChange = (e) => {
    let newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      newValue = Math.min(Math.max(newValue, min), max);
      onChange(Number(newValue.toFixed(2)));
    }
  };

  return (
    <div className="slider-with-input">
      <label htmlFor={id}>{label}</label>
      <div className="slider-input-wrapper">
        <input
          type="range"
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
        />
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          step={step}
          min={min}
          max={max}
        />
      </div>
    </div>
  );
};

export default SliderWithInput;