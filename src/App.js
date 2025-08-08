import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import SliderWithInput from './components/SliderWithInput';
import ContainerSVG from './components/ContainerSVG';
import Cylinder from './components/Cylinder'; // Import the new Cylinder component
import SVGImporter from './components/SVGImporter';

function App() {
  const [volume, setVolume] = useState(1000);
  const [height, setHeight] = useState(100);
  const [diameter, setDiameter] = useState(112.8);
  const [thickness, setThickness] = useState(1); // Combined thickness state
  const [activeView, setActiveView] = useState('3D'); // '3D' or '2D'
  const [strokeColor, setStrokeColor] = useState('#363636');
  const [pathStrokeColor, setPathStrokeColor] = useState('#363636');
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [showMesh, setShowMesh] = useState(false);
  const [roughness, setRoughness] = useState(0.00); // Add this line
  const [customProfile, setCustomProfile] = useState(null);
  const [opacity, setOpacity] = useState(0.8);
  const [metalness, setMetalness] = useState(0.1);
  const [materialRoughness, setMaterialRoughness] = useState(0.8);
  const [flatShading, setFlatShading] = useState(false);

  const updateFromVolume = (newVolume) => {
    const oldVolume = (Math.PI * Math.pow(diameter / 20, 2) * height / 10);
    const volumeScaleRatio = newVolume / oldVolume;
    const dimensionScaleRatio = Math.pow(volumeScaleRatio, 1 / 3);

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

  const handleColorChange = (e) => {
    setPathStrokeColor(e.target.value);
  };

  const handleZoomChange = (e) => {
    setZoom(parseFloat(e.target.value));
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--svg-stroke-color', strokeColor);
  }, [strokeColor]);

  // Zoom controls: + to zoom in, - to zoom out
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.1, 5));
      if (e.key === '-') setZoom(z => Math.max(z - 0.1, 0.1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add this useEffect to debug state changes:
  useEffect(() => {
    console.log('🔄 customProfile state changed:', customProfile);
  }, [customProfile]);

  // Also, let's make sure the handleProfileImported doesn't get recreated on every render:
  const handleProfileImported = useCallback((points) => {
    console.log('App.js - Profile imported:', points);
    setCustomProfile(points);
    console.log('App.js - customProfile state set to:', points);
  }, []);

  return (
    <div className="App">
      <div className="container">
        <div className="visualization-container" style={{
          transform: activeView === '2D' ? `scale(${zoom})` : 'none',
          transformOrigin: 'center center'
        }}>
          {activeView === '2D' ? (
            <div className="svg-container">
              <ContainerSVG
                height={height}
                diameter={diameter}
                strokeWidth={thickness}
                strokeColor={strokeColor}
                zoom={zoom}
                viewportWidth={viewport.width}
                viewportHeight={viewport.height}
              />
            </div>
          ) : (
            <div className="three-d-container">
              {console.log('App.js - Rendering Cylinder with customProfile:', customProfile)}
              <Cylinder
                diameter={customProfile ? 100 : diameter}
                height={customProfile ? 100 : height}
                thickness={thickness}
                strokeColor={strokeColor}
                zoom={zoom}  // Pass zoom for 3D camera control
                showMesh={showMesh}
                roughness={roughness}
                customProfile={customProfile}
                opacity={opacity}
                metalness={metalness}
                materialRoughness={materialRoughness}
                flatShading={flatShading}
              />
            </div>
          )}
        </div>
        <div className="controls">
          <h1 className="app-header">VESSEL</h1>
          <SVGImporter onProfileImported={handleProfileImported} />
          {customProfile && (
            <div>
              <button onClick={() => setCustomProfile(null)}>
                Reset to Default Shape
              </button>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Custom profile active: {customProfile.length} points
              </div>
            </div>
          )}
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
            disabled={customProfile !== null} // Disable when custom profile is active
            style={{
              opacity: customProfile !== null ? 0.5 : 1,
              cursor: customProfile !== null ? 'not-allowed' : 'pointer'
            }}
          />
          <SliderWithInput
            id="diameter"
            label="Diameter (mm)"
            min={10}
            max={1000}
            value={diameter}
            onChange={updateHeightFromDiameter}
            disabled={customProfile !== null} // Disable when custom profile is active
            style={{
              opacity: customProfile !== null ? 0.5 : 1,
              cursor: customProfile !== null ? 'not-allowed' : 'pointer'
            }}
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
          <SliderWithInput
            id="roughness"
            label="Surface Roughness"
            min={0}
            max={0.1}
            step={0.005}
            value={roughness}
            onChange={setRoughness}
          />
          <SliderWithInput
            id="zoom"
            label="Zoom"
            min={0.5}
            max={2}
            step={0.1}
            value={Number(zoom.toFixed(2))}
            onChange={(newZoom) => setZoom(Number(newZoom.toFixed(2)))}
          />
          <SliderWithInput
            id="opacity"
            label="Opacity"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            onChange={setOpacity}
          />
          <SliderWithInput
            id="metalness"
            label="Metalness"
            min={0}
            max={1}
            step={0.05}
            value={metalness}
            onChange={setMetalness}
          />
          <SliderWithInput
            id="materialRoughness"
            label="Material Roughness"
            min={0}
            max={1}
            step={0.05}
            value={materialRoughness}
            onChange={setMaterialRoughness}
          />
          <div className="control-group">
            <label htmlFor="strokeColor">Stroke Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="strokeColor"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
              />
              <span className="color-value">{strokeColor}</span>
            </div>
            <div className="switch-wrapper">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={activeView === '3D'}
                  onChange={toggleView}
                />
                <span className="slider round"></span>
              </label>
              <span className="switch-label">{activeView === '3D' ? '3D' : '2D'}</span>
            </div>
          </div>
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={showMesh}
                onChange={e => setShowMesh(e.target.checked)}
              />
              Show Mesh
            </label>
          </div>
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={flatShading}
                onChange={e => setFlatShading(e.target.checked)}
              />
              Flat Shading
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;