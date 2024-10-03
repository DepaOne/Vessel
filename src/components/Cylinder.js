import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const Cylinder = ({ diameter, height, thickness }) => {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Cylinder component effect running');
    const mount = mountRef.current;
    if (!mount) {
      console.error('Mount ref is null');
      return;
    }

    console.log('Mount dimensions:', mount.clientWidth, mount.clientHeight);

    let scene, camera, renderer;

    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);

      if (!rendererRef.current) {
        renderer = new THREE.WebGLRenderer({ alpha: true });
        rendererRef.current = renderer;
      } else {
        renderer = rendererRef.current;
      }

      renderer.setSize(mount.clientWidth, mount.clientHeight);
      mount.appendChild(renderer.domElement);

      console.log('Scene, camera, and renderer created');

      // Create a simple cylinder for testing
      const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0xEBA583 });
      const cylinder = new THREE.Mesh(geometry, material);
      scene.add(cylinder);

      console.log('Cylinder added to scene');

      // Position camera
      camera.position.z = Math.max(diameter, height) * 1.5;
      camera.position.y = height / 2;
      camera.lookAt(scene.position);

      console.log('Camera positioned');

      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      console.log('Animation loop started');
    } catch (err) {
      console.error('Error in Cylinder component:', err);
      setError(err.message);
    }

    return () => {
      console.log('Cleanup function called');
      if (renderer && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      if (scene) {
        scene.clear();
      }
    };
  }, [diameter, height, thickness]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Cylinder;