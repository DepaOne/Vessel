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
  zoom,           // Add zoom prop here
  customProfile = null
}) => {
  const mountRef = useRef(null);

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
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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

    // Create geometry using LatheGeometry
    const geometry = new THREE.LatheGeometry(points, 128);
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
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
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
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
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

      // Normalize Y coordinates to 0-100 range
      const minY = Math.min(...validPoints.map(p => p.y));
      const maxY = Math.max(...validPoints.map(p => p.y));

      if (maxY > minY) {
        validPoints = validPoints.map(point => new THREE.Vector2(
          point.x,
          ((point.y - minY) / (maxY - minY)) * 100
        ));
      }

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

  }, [diameter, height, thickness, strokeColor, showMesh, roughness, zoom, customProfile]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Cylinder;