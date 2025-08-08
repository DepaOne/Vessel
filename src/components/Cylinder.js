import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const Cylinder = ({
  diameter,
  height,
  thickness,
  strokeColor,
  showMesh,
  roughness,
  zoom,
  customProfile = null,
  opacity = 0.8,
  metalness = 0.1,
  materialRoughness = 0.8,
  wireframeMode = false,
  flatShading = false
}) => {
  const mountRef = useRef(null);
  const rafRef = useRef(0); // track animation frame

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    console.log('Cylinder useEffect - customProfile:', customProfile);



    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Add this line to update camera aspect ratio:
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    // Camera Position - use zoom for distance in 3D
    const baseDistance = Math.max(diameter, height) * 4;  // Increased from 2.5 to 4
    const zoomDistance = baseDistance / zoom;
    camera.position.set(0, height / 2, zoomDistance);
    camera.lookAt(0, height / 2, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, height, Math.max(diameter, height));
    scene.add(directionalLight);

    let points = [];

    if (customProfile && customProfile.length > 0) {
      console.log('Using custom profile with', customProfile.length, 'points:', customProfile);
      // Use imported SVG profile
      try {
        points = customProfile
          .filter(point => point && typeof point.x === 'number' && typeof point.y === 'number')
          .map(point => new THREE.Vector2(Math.abs(point.x), point.y));

        console.log('Converted to Vector2:', points);

        if (points.length > 0) {
          // points = validateAndFixProfile(points);
          function analyzeAndScaleProfile(rawPoints, targetHeight, preserveAspect = true) {
            if (!rawPoints.length) return rawPoints;

            // Original bounds
            const minY = Math.min(...rawPoints.map(p => p.y));
            const maxY = Math.max(...rawPoints.map(p => p.y));
            const originalHeight = maxY - minY || 1;

            // For a lathe profile x is radius (>=0). Width = maxX (since minX is typically 0)
            const maxX = Math.max(...rawPoints.map(p => p.x));
            const originalWidth = maxX || 1;

            const originalAspect = originalHeight / originalWidth; // H:W

            // Desired scaling (we map height to targetHeight; apply same factor to X if preserving aspect)
            const heightScale = targetHeight / originalHeight;
            const widthScale = preserveAspect ? heightScale : 1; // If not preserving, you could compute separately

            const scaled = rawPoints.map(p => new THREE.Vector2(p.x * widthScale, (p.y - minY) * heightScale));

            // New bounds
            const newHeight = Math.max(...scaled.map(p => p.y)) - Math.min(...scaled.map(p => p.y));
            const newWidth = Math.max(...scaled.map(p => p.x));
            const newAspect = newHeight / (newWidth || 1);

            console.group('SVG Aspect Debug');
            console.log('Original width (radius extent):', originalWidth);
            console.log('Original height:', originalHeight);
            console.log('Original aspect (H/W):', originalAspect.toFixed(4));
            console.log('Scaled width:', newWidth);
            console.log('Scaled height:', newHeight);
            console.log('Scaled aspect (H/W):', newAspect.toFixed(4));
            console.log('Aspect drift (%):', (((newAspect - originalAspect) / originalAspect) * 100).toFixed(3), '%');
            console.groupEnd();

            return scaled;
          }

          points = analyzeAndScaleProfile(points, height, true); // true => preserve aspect
          points = validateAndFixProfile(points);
          console.log('After validation:', points);
        } else {
          throw new Error('No valid points in custom profile');
        }
      } catch (error) {
        console.warn('Invalid custom profile, using default:', error);
        points = createDefaultProfile();
      }
    } else {
      console.log('No custom profile, using default');
      points = createDefaultProfile();
    }

    // Validate that all points are proper THREE.Vector2 objects
    const validPoints = points.filter(point =>
      point instanceof THREE.Vector2 &&
      typeof point.x === 'number' &&
      typeof point.y === 'number' &&
      !isNaN(point.x) && !isNaN(point.y)
    );

    console.log('Valid points for LatheGeometry:', validPoints);

    if (validPoints.length < 3) {
      console.warn('Not enough valid points, using default profile');
      points = createDefaultProfile();
    } else {
      points = validPoints;
    }

    console.log('Final points passed to LatheGeometry:', points.map(p => `(${p.x}, ${p.y})`));

    // Hard-cap profile density to avoid huge vertical face counts
    const MAX_PROFILE_POINTS = 400; // adjust as needed (lower => fewer vertical faces)
    if (points.length > MAX_PROFILE_POINTS) {
      const decimated = [];
      for (let i = 0; i < MAX_PROFILE_POINTS; i++) {
        const idx = Math.round((i / (MAX_PROFILE_POINTS - 1)) * (points.length - 1));
        decimated.push(points[idx]);
      }
      points = decimated;
      console.warn(`[Lathe] Decimated profile to ${points.length} points`);
    }

    // Before creating LatheGeometry (right above new THREE.LatheGeometry)
    const MAX_VERTS = 160000;       // was 80000
    let radialSegments = 64;        // was 32/48/128 depending on your last edit
    let estVerts = (points?.length || 0) * radialSegments;
    if (estVerts > MAX_VERTS && points?.length) {
      radialSegments = Math.max(12, Math.floor(MAX_VERTS / points.length));
    }

    // Create geometry using LatheGeometry
    const geometry = new THREE.LatheGeometry(points, radialSegments);
    geometry.translate(0, -height / 2, 0);

    // Add surface roughness using deterministic noise
    if (roughness > 0) {
      const positionAttribute = geometry.getAttribute('position');
      const vertex = new THREE.Vector3();

      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);

        const seed = i * 0.1;
        const noise1 = Math.sin(seed * 12.9898) * 43758.5453;
        const noise2 = Math.sin(seed * 78.233) * 43758.5453;
        const noise3 = Math.sin(seed * 39.346) * 43758.5453;

        const noiseX = (noise1 - Math.floor(noise1) - 0.5) * roughness;
        const noiseZ = (noise2 - Math.floor(noise2) - 0.5) * roughness;
        const noiseY = (noise3 - Math.floor(noise3) - 0.5) * roughness * 0.5;

        vertex.x += vertex.x * noiseX;
        vertex.z += vertex.z * noiseZ;
        vertex.y += noiseY;

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
    }

    // ADD RED AXIS LINE HERE - for debugging SVG positioning
    const axisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1000, 0),  // Bottom of vessel
      new THREE.Vector3(0, 1000, 0)    // Top of vessel
    ]);
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red
    const axisLine = new THREE.Line(axisGeometry, axisMaterial);
    scene.add(axisLine);

    // Store reference to remove it later
    if (window.axisLine) {
      scene.remove(window.axisLine);
    }
    window.axisLine = axisLine;

    if (showMesh) {
      const material = new THREE.MeshStandardMaterial({
        color: strokeColor || 0x888888,
        metalness: metalness,
        roughness: materialRoughness,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        opacity: opacity,
        wireframe: wireframeMode,
        flatShading: flatShading,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    } else {
      const edges = new THREE.EdgesGeometry(geometry);
      const material = new THREE.LineBasicMaterial({
        color: strokeColor || 0x000000,
        linewidth: 1
      });
      const wireframe = new THREE.LineSegments(edges, material);
      scene.add(wireframe);
    }

    // Animation Loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate); // store id
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(rafRef.current); // stop loop
      rafRef.current = 0;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };

    function createDefaultProfile() {
      const outerRadius = diameter / 2;
      const innerRadius = outerRadius - thickness;
      const baseThickness = thickness;

      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(outerRadius, 0),
        new THREE.Vector2(outerRadius, height),
        new THREE.Vector2(innerRadius, height),
        new THREE.Vector2(innerRadius, baseThickness),
        new THREE.Vector2(0, baseThickness)
      ];
    }

    function validateAndFixProfile(points) {
      if (!points || points.length === 0) {
        return createDefaultProfile();
      }

      console.log('Validating profile points:', points);

      // Ensure all points are valid Vector2 objects
      let validPoints = points.filter(point =>
        point instanceof THREE.Vector2 &&
        typeof point.x === 'number' &&
        typeof point.y === 'number' &&
        !isNaN(point.x) && !isNaN(point.y)
      );

      if (validPoints.length < 3) {
        console.warn('Not enough valid points after validation');
        return createDefaultProfile();
      }

      // Ensure proper pottery orientation: bottom to top (Y: 0 to 100)
      // Sort by Y coordinate to ensure proper order
      validPoints.sort((a, b) => a.y - b.y);

      // COMMENT OUT this block to preserve original Y proportions:
      /*
      // Normalize Y coordinates to 0-100 range
      const minY = Math.min(...validPoints.map(p => p.y));
      const maxY = Math.max(...validPoints.map(p => p.y));

      if (maxY > minY) {
        validPoints = validPoints.map(point => new THREE.Vector2(
          point.x,
          ((point.y - minY) / (maxY - minY)) * 100
        ));
      }
      */

      // For lathe geometry, ensure the profile starts and ends at the center axis (x=0)
      // Add center point at bottom if needed
      if (validPoints[0].x !== 0) {
        validPoints.unshift(new THREE.Vector2(0, validPoints[0].y));
      }

      // Add center point at top if needed
      if (validPoints[validPoints.length - 1].x !== 0) {
        validPoints.push(new THREE.Vector2(0, validPoints[validPoints.length - 1].y));
      }

      console.log('Validated points (bottom to top):', validPoints.map(p => `(${p.x}, ${p.y})`));
      return validPoints;
    }

    function addAspectDebugBox(profilePoints) {
      if (!profilePoints.length) return;
      const maxR = Math.max(...profilePoints.map(p => p.x));
      const minY = Math.min(...profilePoints.map(p => p.y));
      const maxY = Math.max(...profilePoints.map(p => p.y));

      // Simple rectangle outline (in X/Y plane at Z= - (diameter) just to push it back)
      const boxGeom = new THREE.BufferGeometry();
      const verts = new Float32Array([
        0, minY, 0,
        maxR, minY, 0,
        maxR, minY, 0,
        maxR, maxY, 0,
        maxR, maxY, 0,
        0, maxY, 0,
        0, maxY, 0,
        0, minY, 0,
      ]);
      boxGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const boxMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
      const boxLines = new THREE.LineSegments(boxGeom, boxMat);
      boxLines.name = 'aspectDebugBox';
      scene.add(boxLines);
    }

    // After points = validateAndFixProfile(points);
    addAspectDebugBox(points);

  }, [diameter, height, thickness, strokeColor, showMesh, roughness, zoom, customProfile, opacity, metalness, materialRoughness, wireframeMode, flatShading]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Cylinder;