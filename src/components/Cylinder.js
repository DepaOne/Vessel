import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { CSG } from 'three-csg-ts';

const Cylinder = ({ diameter, height, thickness, width, canvasHeight }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / canvasHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable alpha (transparency)
    renderer.setSize(width, canvasHeight);
    renderer.setClearColor(0x000000, 0); // Set clear color to transparent
    renderer.shadowMap.enabled = true; // Enable shadow mapping
    mount.appendChild(renderer.domElement);

    // Create the outer cylinder (body of the mug)
    const outerGeometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, 32);
    const outerMesh = new THREE.Mesh(outerGeometry);
    
    // Create the inner cylinder (hollow part of the mug) with a shorter height
    const innerHeight = height + thickness; // Shorten the inner cylinder
    const innerGeometry = new THREE.CylinderGeometry((diameter / 2) - thickness, (diameter / 2) - thickness, innerHeight, 32);
    const innerMesh = new THREE.Mesh(innerGeometry);
    innerGeometry.translate(0, thickness, 0);

    // Use CSG to subtract the inner cylinder from the outer cylinder
    const subtractedMesh = CSG.subtract(outerMesh, innerMesh);
    const mugMaterial = new THREE.MeshStandardMaterial({ color: 0xEBA583 });
    const mugMesh = new THREE.Mesh(subtractedMesh.geometry, mugMaterial);
    scene.add(mugMesh);

    // Add a directional light to illuminate the solid surfaces
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(height * 2, height, 5).normalize();
    scene.add(directionalLight);

    // Add ambient light to brighten the scene
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);

    // Position the camera outside the cylinder
    camera.position.z = diameter * 1.5;
    camera.position.y = height * 1.5; // Adjust the camera height to better view the mug

    // Point the camera at the center of the mug
    camera.lookAt(mugMesh.position);

    const animate = () => {
      requestAnimationFrame(animate);
      mugMesh.rotation.y += 0.01; // Add rotation to the mug
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mount.removeChild(renderer.domElement);
    };
  }, [diameter, height, thickness, width, canvasHeight]);

  return <div ref={mountRef} />;
};

export default Cylinder;