export const FILE_VERSION = 1;
export const FILE_TYPE = 'vessel-project';

export function serializeProject(state) {
  const {
    // profile
    customProfile, // e.g. { type:'svg-path', d: 'M...' }
    mirror = true,
    lockRight = true,

    // dimensions
    volume, height, diameter, thickness,

    // view
    activeView, zoom, showMesh, viewport,

    // material
    opacity, metalness, materialRoughness, flatShading,

    // theme-ish
    strokeColor, pathStrokeColor,
  } = state;

  return {
    type: FILE_TYPE,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    profile: {
      representation: customProfile?.type || 'svg-path',
      data: customProfile || null, // keep object so we can extend later
      mirror, lockRight,
    },
    dimensions: { volume, height, diameter, thickness },
    view: { activeView, zoom, showMesh, viewport },
    material: {
      opacity,
      metalness,
      roughness: materialRoughness,
      flatShading,
    },
    theme: { strokeColor, pathStrokeColor },
  };
}

export function isVesselProject(json) {
  return json && json.type === FILE_TYPE && typeof json.version === 'number';
}

export function deserializeProject(json) {
  if (!isVesselProject(json)) throw new Error('Not a Vessel project file');

  const prof = json.profile || {};
  const dims = json.dimensions || {};
  const view = json.view || {};
  const mat = json.material || {};
  const theme = json.theme || {};

  return {
    // profile
    customProfile: prof.data || null,
    mirror: !!prof.mirror,
    lockRight: prof.lockRight !== false,

    // dimensions
    volume: numOr(dims.volume, 1000),
    height: numOr(dims.height, 100),
    diameter: numOr(dims.diameter, 110),
    thickness: numOr(dims.thickness, 1),

    // view
    activeView: view.activeView || '3D',
    zoom: numOr(view.zoom, 1),
    showMesh: !!view.showMesh,
    viewport: view.viewport || null,

    // material
    opacity: numOr(mat.opacity, 0.8),
    metalness: numOr(mat.metalness, 0.1),
    materialRoughness: numOr(mat.roughness, 0.8),
    flatShading: !!mat.flatShading,

    // theme
    strokeColor: theme.strokeColor || '#363636',
    pathStrokeColor: theme.pathStrokeColor || '#363636',
  };
}

function numOr(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }