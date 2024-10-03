import React, { useState } from 'react';
import './App.css';
import SliderWithInput from './components/SliderWithInput';
import ContainerSVG from './components/ContainerSVG';
import Cylinder from './components/Cylinder'; // Import the new Cylinder component


function App() {
  const [volume, setVolume] = useState(1000);
  const [height, setHeight] = useState(100);
  const [diameter, setDiameter] = useState(112.8);
  const [thickness, setThickness] = useState(1); // Combined thickness state
  const [activeView, setActiveView] = useState('3D'); // '3D' or '2D'

  const updateFromVolume = (newVolume) => {
    const oldVolume = (Math.PI * Math.pow(diameter / 20, 2) * height / 10);
    const volumeScaleRatio = newVolume / oldVolume;
    const dimensionScaleRatio = Math.pow(volumeScaleRatio, 1/3);
    
    const newHeight = parseFloat((height * dimensionScaleRatio).toFixed(1));
    const newDiameter = parseFloat((diameter * dimensionScaleRatio).toFixed(1));
    
    setHeight(newHeight);
    setDiameter(newDiameter);
    setVolume(newVolume);
  };

  const updateDiameterFromHeight = (newHeight) => {
    const newDiameter = Math.sqrt((4 * volume) / (Math.PI * newHeight / 10)) * 10;
    setDiameter(parseFloat(newDiameter.toFixed(1)));
    setHeight(newHeight);
  };

  const updateHeightFromDiameter = (newDiameter) => {
    const newHeight = ((4 * volume) / (Math.PI * Math.pow(newDiameter / 10, 2))) * 10;
    setHeight(parseFloat(newHeight.toFixed(1)));
    setDiameter(newDiameter);
  };

  const toggleView = () => {
    setActiveView(prevView => prevView === '3D' ? '2D' : '3D');
  };

  return (
    <div className="App">
      <div className="container">
        <div className="visualization-container">
          {activeView === '3D' ? (
            <div className="three-d-container">
              {console.log('Rendering 3D view', { diameter, height, thickness })}
              <Cylinder 
                diameter={diameter} 
                height={height} 
                thickness={thickness}
              />
            </div>
          ) : (
            <div className="svg-container">
              {console.log('Rendering 2D view')}
              <ContainerSVG height={height} diameter={diameter} strokeWidth={thickness} />
            </div>
          )}
        </div>
        <div className="controls">
          <SliderWithInput
            id="volume"
            label="Volume (mL)"
            min={1}
            max={10000}
            value={volume}
            onChange={updateFromVolume}
          />
          <SliderWithInput
            id="height"
            label="Height (mm)"
            min={10}
            max={1000}
            value={height}
            onChange={updateDiameterFromHeight}
          />
          <SliderWithInput
            id="diameter"
            label="Diameter (mm)"
            min={10}
            max={1000}
            value={diameter}
            onChange={updateHeightFromDiameter}
          />
          <SliderWithInput
            id="thickness"
            label="Thickness (mm)"
            min={0.1}
            max={10}
            step={0.1}
            value={thickness}
            onChange={setThickness}
          />
          <div className="switch-container">
            <span className={`switch-label ${activeView === '2D' ? 'active' : ''}`}>2D</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={activeView === '3D'}
                onChange={toggleView}
              />
              <span className="slider round"></span>
            </label>
            <span className={`switch-label ${activeView === '3D' ? 'active' : ''}`}>3D</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;