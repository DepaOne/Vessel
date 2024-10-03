import React, { useState } from 'react';
import './App.css';
import SliderWithInput from './components/SliderWithInput';
import ContainerSVG from './components/ContainerSVG';
import Cylinder from './components/Cylinder'; // Import the new Cylinder component

function App() {
  const [volume, setVolume] = useState(1000);
  const [height, setHeight] = useState(100);
  const [diameter, setDiameter] = useState(112.8);
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [thickness, setThickness] = useState(5); // Add this state for cylinder thickness

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

  return (
    <div className="App">
      <div className="container">
        <div className="visualization-container">
          <div className="svg-container">
            <ContainerSVG height={height} diameter={diameter} strokeWidth={strokeWidth} />
          </div>
          <div className="three-d-container">
            <Cylinder 
              diameter={diameter} 
              height={height} 
              thickness={thickness} 
              width={300} 
              canvasHeight={300}
            />
          </div>
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
            id="strokeWidth"
            label="Stroke Width (mm)"
            min={0.1}
            max={10}
            step={0.1}
            value={strokeWidth}
            onChange={setStrokeWidth}
          />
          <SliderWithInput
            id="thickness"
            label="Thickness (mm)"
            min={1}
            max={20}
            step={0.1}
            value={thickness}
            onChange={setThickness}
          />
        </div>
      </div>
    </div>
  );
}

export default App;