import React, { useState, useEffect, useCallback, useRef } from 'react';
import './styles/theme.css';
import './App.css';
import SliderWithInput from './components/SliderWithInput';
import ContainerSVG from './components/ContainerSVG';
import Cylinder from './components/Cylinder';
import SVGImporter from './components/SVGImporter';
import ProfileEditor from './components/ProfileEditor';
import { serializeProject, deserializeProject } from './utils/saveLoad';

function App() {
  const [volume, setVolume] = useState(1000);
  const [height, setHeight] = useState(100);
  const [diameter, setDiameter] = useState(112.8);
  const [thickness, setThickness] = useState(1);
  const [activeView, setActiveView] = useState('3D');
  const [strokeColor, setStrokeColor] = useState('#363636');
  const [pathStrokeColor, setPathStrokeColor] = useState('#363636');
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [showMesh, setShowMesh] = useState(false);
  const [roughness, setRoughness] = useState(0.00);
  const [customProfile, setCustomProfile] = useState(null); // expect { type:'svg-path', d: '...' }
  const [opacity, setOpacity] = useState(0.8);
  const [metalness, setMetalness] = useState(0.1);
  const [materialRoughness, setMaterialRoughness] = useState(0.8);
  const [flatShading, setFlatShading] = useState(false);

  // Editor preferences (optional if you store them globally)
  const [mirror, setMirror] = useState(true);
  const [lockRight, setLockRight] = useState(true);

  // Save to file
  const saveProject = useCallback(() => {
    const data = serializeProject({
      customProfile,
      mirror, lockRight,
      volume, height, diameter, thickness,
      activeView, zoom, showMesh, viewport,
      opacity, metalness, materialRoughness, flatShading,
      strokeColor, pathStrokeColor,
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `vessel-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    customProfile, mirror, lockRight,
    volume, height, diameter, thickness,
    activeView, zoom, showMesh, viewport,
    opacity, metalness, materialRoughness, flatShading,
    strokeColor, pathStrokeColor
  ]);

  // Load from file
  const fileInputRef = useRef(null);
  const requestLoad = () => fileInputRef.current?.click();
  const handleLoadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const patch = deserializeProject(json);

      // Apply to state
      setCustomProfile(patch.customProfile);
      setMirror(patch.mirror);
      setLockRight(patch.lockRight);

      setVolume(patch.volume);
      setHeight(patch.height);
      setDiameter(patch.diameter);
      setThickness(patch.thickness);

      setActiveView(patch.activeView);
      setZoom(patch.zoom);
      setShowMesh(patch.showMesh);
      if (patch.viewport) setViewport(patch.viewport);

      setOpacity(patch.opacity);
      setMetalness(patch.metalness);
      setMaterialRoughness(patch.materialRoughness);
      setFlatShading(patch.flatShading);

      setStrokeColor(patch.strokeColor);
      setPathStrokeColor(patch.pathStrokeColor);
    } catch (err) {
      console.error('Load failed:', err);
      alert('Failed to load project: ' + err.message);
    } finally {
      e.target.value = ''; // allow re-selecting same file
    }
  };

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

  const handleProfileFromEditor = useCallback((pathData) => {
    const { svgPathToPoints, normalizeProfile } = require('./utils/svgProfile');
    const { points } = svgPathToPoints(pathData);
    const norm = normalizeProfile(points);
    setCustomProfile(norm);
    setActiveView('3D');
  }, []);

  return (
    <div className="App">
      {/* Hidden input for loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleLoadFile}
        style={{ display: 'none' }}
      />

      <div className="container">
        <div className="visualization-container" style={{
          transform: activeView === '2D' ? `scale(${zoom})` : 'none',
          transformOrigin: 'center center'
        }}>
          {activeView === 'DRAW' ? (
            <ProfileEditor onApply={handleProfileFromEditor} onCancel={() => setActiveView('3D')} />
          ) : activeView === '2D' ? (
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
          </div>
          <div className="control-group">
            <label>View</label>
            <div>
              <label><input type="radio" checked={activeView === '2D'} onChange={() => setActiveView('2D')} /> 2D</label>
              <label style={{ marginLeft: 12 }}><input type="radio" checked={activeView === '3D'} onChange={() => setActiveView('3D')} /> 3D</label>
              <label style={{ marginLeft: 12 }}><input type="radio" checked={activeView === 'DRAW'} onChange={() => setActiveView('DRAW')} /> Draw</label>
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
          <button onClick={saveProject}>Save Project</button>
          <button onClick={requestLoad}>Load Project</button>
        </div>
      </div>
    </div>
  );
}

export default App;