import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import './App.css';

CameraControls.install({ THREE });

// Helper function to create a circular texture
const createCircleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    context.beginPath();
    context.arc(16, 16, 16, 0, 2 * Math.PI);
    context.fillStyle = 'white';
    context.fill();
  }
  return new THREE.CanvasTexture(canvas);
};

const createRingTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.beginPath();
    context.arc(32, 32, 28, 0, 2 * Math.PI);
    context.lineWidth = 4;
    context.strokeStyle = 'white';
    context.stroke();
  }
  return new THREE.CanvasTexture(canvas);
};

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
  regions: { [key: string]: any };
  constellations: { [key: string]: any };
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSystem, setHighlightedSystem] = useState<SolarSystem | null>(null);
  const [hoveredSystem, setHoveredSystem] = useState<SolarSystem | null>(null);

  // Refs for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<CameraControls | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const hoverPointRef = useRef<THREE.Points | null>(null);
  const visibleSystemsRef = useRef<SolarSystem[]>([]);
  const prevHighlightedSystemRef = useRef<SolarSystem | null>(null);

  const circleTexture = useMemo(() => createCircleTexture(), []);
  const ringTexture = useMemo(() => createRingTexture(), []);

  const pointsMaterial = useMemo(() => new THREE.PointsMaterial({
    size: 2,
    sizeAttenuation: true,
    map: circleTexture,
    transparent: true,
    alphaTest: 0.5,
    vertexColors: true,
  }), [circleTexture]);

  // Fetch data
  useEffect(() => {
    fetch('/map_data.json')
      .then((response) => response.json())
      .then((data: MapData) => setMapData(data))
      .catch((error) => console.error('Error loading map data:', error));
  }, []);

  const getTransformedPosition = useCallback((position: { x: number; y: number; z: number }) => {
    return {
      x: position.x,
      y: position.z,
      z: position.y * -1,
    };
  }, []);

  // Initialize Scene
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    sceneRef.current = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000000);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(window.innerWidth, window.innerHeight);
    currentMount.appendChild(renderer.domElement);

    camera.up.set(0, 1, 0);
    camera.position.set(0, 0, 5000);

    const controls = new CameraControls(camera, renderer.domElement);
    controls.mouseButtons.left = CameraControls.ACTION.ROTATE;
    controls.mouseButtons.right = CameraControls.ACTION.TRUCK;
    controls.mouseButtons.middle = CameraControls.ACTION.DOLLY;
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI - 0.01;
    controls.dollyToCursor = true;
    controls.dampingFactor = 0.12;
    controls.draggingDampingFactor = 0.15;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0);
    sceneRef.current.add(directionalLight);

    // Hover Point
    const hoverGeometry = new THREE.BufferGeometry();
    hoverGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const hoverMaterial = new THREE.PointsMaterial({
      size: 20,
      sizeAttenuation: false,
      map: ringTexture,
      color: 0xff4c26,
      transparent: true,
      alphaTest: 0.5,
    });
    hoverPointRef.current = new THREE.Points(hoverGeometry, hoverMaterial);
    hoverPointRef.current.visible = false;
    sceneRef.current.add(hoverPointRef.current);

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      controls.update(delta);
      if (sceneRef.current && cameraRef.current) {
        renderer.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      currentMount.removeChild(renderer.domElement);
    };
  }, [ringTexture]);

  // Create and update starfield and stargates
  useEffect(() => {
    if (!mapData || !sceneRef.current) return;

    if (starFieldRef.current) {
      sceneRef.current.remove(starFieldRef.current);
      starFieldRef.current.geometry.dispose();
    }

    visibleSystemsRef.current = Object.values(mapData.solar_systems).filter(s => s && s.position && !s.hidden);

    const vertices = [];
    const colors = [];
    const white = new THREE.Color(0xffffff);

    for (const system of visibleSystemsRef.current) {
      const pos = getTransformedPosition(system.position);
      vertices.push(pos.x, pos.y, pos.z);
      colors.push(white.r, white.g, white.b);
    }

    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    starFieldRef.current = new THREE.Points(pointsGeometry, pointsMaterial);
    sceneRef.current.add(starFieldRef.current);

    const stargateMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.1 });
    if (mapData.stargates) {
      Object.values(mapData.stargates).forEach((stargate) => {
        const sourceSystem = mapData.solar_systems[stargate.source_system_id];
        const destinationSystem = mapData.solar_systems[stargate.destination_system_id];
        if (sourceSystem && destinationSystem && sourceSystem.position && destinationSystem.position && !sourceSystem.hidden && !destinationSystem.hidden) {
          const sourcePos = getTransformedPosition(sourceSystem.position);
          const destPos = getTransformedPosition(destinationSystem.position);
          const points = [new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z), new THREE.Vector3(destPos.x, destPos.y, destPos.z)];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, stargateMaterial);
          sceneRef.current?.add(line);
        }
      });
    }
  }, [mapData, getTransformedPosition, pointsMaterial]);

  // Handle highlighting
  useEffect(() => {
    if (!starFieldRef.current) return;
    const colors = starFieldRef.current.geometry.attributes.color as THREE.BufferAttribute;
    const white = new THREE.Color(0xffffff);
    const red = new THREE.Color(0xff4c26);

    if (prevHighlightedSystemRef.current) {
      const prevIndex = visibleSystemsRef.current.findIndex(s => s.id === prevHighlightedSystemRef.current!.id);
      if (prevIndex !== -1) {
        white.toArray(colors.array, prevIndex * 3);
      }
    }

    if (highlightedSystem) {
      const highlightedIndex = visibleSystemsRef.current.findIndex(s => s.id === highlightedSystem.id);
      if (highlightedIndex !== -1) {
        red.toArray(colors.array, highlightedIndex * 3);
      }
    }
    colors.needsUpdate = true;
    prevHighlightedSystemRef.current = highlightedSystem;
  }, [highlightedSystem]);

  // Handle camera animation
  useEffect(() => {
    if (!highlightedSystem || !controlsRef.current) return;

    const newTarget = new THREE.Vector3();
    const transformedPos = getTransformedPosition(highlightedSystem.position);
    newTarget.set(transformedPos.x, transformedPos.y, transformedPos.z);

    controlsRef.current.setTarget(newTarget.x, newTarget.y, newTarget.z, true);
  }, [highlightedSystem, getTransformedPosition]);

  // Handle Hover Effect
  useEffect(() => {
    const hoverPoint = hoverPointRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;

    if (hoverPoint && camera && renderer) {
      if (hoveredSystem) {
        const pos = getTransformedPosition(hoveredSystem.position);
        hoverPoint.position.set(pos.x, pos.y, pos.z);

        // Adaptive sizing
        const worldPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const distance = camera.position.distanceTo(worldPos);
        const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        const projectedStarSize = (pointsMaterial.size * scale) / distance;

        const minRingSize = 15;
        const ringPadding = 10;
        const newRingSize = Math.max(minRingSize, projectedStarSize + ringPadding);
        
        (hoverPoint.material as THREE.PointsMaterial).size = newRingSize;

        hoverPoint.visible = true;
      } else {
        hoverPoint.visible = false;
      }
    }
  }, [hoveredSystem, getTransformedPosition, pointsMaterial]);

  // Handle Pointer Events
  useEffect(() => {
    const currentRenderer = rendererRef.current;
    if (!currentRenderer) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (event: PointerEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      if (cameraRef.current && starFieldRef.current) {
        raycaster.setFromCamera(mouse, cameraRef.current);
        raycaster.params.Points.threshold = 5;
        const intersects = raycaster.intersectObject(starFieldRef.current);
        if (intersects.length > 0 && intersects[0].index !== undefined) {
          setHoveredSystem(visibleSystemsRef.current[intersects[0].index]);
        } else {
          setHoveredSystem(null);
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (hoveredSystem) {
        setHighlightedSystem(hoveredSystem);
      }
    };

    currentRenderer.domElement.addEventListener('pointermove', onPointerMove);
    currentRenderer.domElement.addEventListener('pointerdown', onPointerDown);

    return () => {
      currentRenderer.domElement.removeEventListener('pointermove', onPointerMove);
      currentRenderer.domElement.removeEventListener('pointerdown', onPointerDown);
    };
  }, [hoveredSystem]);

  const handleSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && mapData) {
      const query = searchQuery.toLowerCase();
      const foundSystem = Object.values(mapData.solar_systems).find(
        (system) => system.name.toLowerCase() === query
      );
      if (foundSystem) {
        setHighlightedSystem(foundSystem);
      } else {
        setHighlightedSystem(null);
        alert('System not found');
      }
    }
  };

  return (
    <>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
        <input
          type="text"
          placeholder="Search for a system..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          style={{ padding: '5px' }}
        />
      </div>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}

export default App;
