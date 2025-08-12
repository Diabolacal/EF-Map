import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './App.css';

interface SolarSystem {
  id: number;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  region_id: number;
  constellation_id: number;
  planets: number;
  hidden?: boolean;
}

interface Stargate {
  id: number;
  name: string;
  source_system_id: number;
  destination_system_id: number;
}

interface MapData {
  solar_systems: { [key: string]: SolarSystem };
  stargates: { [key: string]: Stargate };
  regions: { [key: string]: any }; // Define more precisely if needed
  constellations: { [key: string]: any }; // Define more precisely if needed
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);

  useEffect(() => {
    // Fetch map data
    fetch('/map_data.json')
      .then((response) => response.json())
      .then((data: MapData) => {
        setMapData(data);
        console.log('Map data loaded:', data); // Log loaded data
      })
      .catch((error) => console.error('Error loading map data:', error));
  }, []);

  useEffect(() => {
    if (!mapData || !mountRef.current) return;

    console.log('Rendering map with data:', mapData); // Log when rendering starts

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.z = 5000; // Initial camera position

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0); // from top
    scene.add(directionalLight);

    // Render Solar Systems
    const systemGeometry = new THREE.SphereGeometry(50, 16, 16); // Small spheres for systems
    const systemMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green systems

    let systemCount = 0;
    if (mapData.solar_systems) {
      Object.values(mapData.solar_systems).forEach((system) => {
        if (system && system.position && !system.hidden) {
          const systemMesh = new THREE.Mesh(systemGeometry, systemMaterial);
          systemMesh.position.set(
            system.position.x,
            system.position.y,
            system.position.z
          );
          scene.add(systemMesh);
          systemCount++;
        }
      });
    }
    console.log('Rendered solar systems:', systemCount); // Log rendered systems

    // Render Stargates (lines between connected systems)
    const stargateMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue lines

    let stargateCount = 0;
    if (mapData.stargates) {
      Object.values(mapData.stargates).forEach((stargate) => {
        const sourceSystem = mapData.solar_systems[stargate.source_system_id];
        const destinationSystem = mapData.solar_systems[stargate.destination_system_id];

        if (
          sourceSystem &&
          destinationSystem &&
          !sourceSystem.hidden &&
          !destinationSystem.hidden &&
          sourceSystem.position &&
          destinationSystem.position
        ) {
          const points = [];
          points.push(new THREE.Vector3(sourceSystem.position.x, sourceSystem.position.y, sourceSystem.position.z));
          points.push(new THREE.Vector3(destinationSystem.position.x, destinationSystem.position.y, destinationSystem.position.z));

          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, stargateMaterial);
          scene.add(line);
          stargateCount++;
        }
      });
    }
    console.log('Rendered stargates:', stargateCount); // Log rendered stargates

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update(); // Only required if controls.enableDamping or controls.autoRotate are set to true
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      systemGeometry.dispose();
      systemMaterial.dispose();
      stargateMaterial.dispose();
    };
  }, [mapData]); // Re-run effect when mapData changes

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
}

export default App;
