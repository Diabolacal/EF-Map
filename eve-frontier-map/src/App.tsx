import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './App.css';
import RegionHighlighterModule from './modules/RegionHighlighter';
import initSqlJs from 'sql.js';

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

// Add these interfaces
type SystemRow = [
  number, // id
  string, // name
  number, // constellation_id
  number, // region_id
  any, any, any, // placeholder for unused columns
  number, // position.x
  number, // position.y
  number, // position.z
  any, any, any, // placeholder for unused columns
  boolean // hidden
];

type StargateRow = [
  number, // id
  string, // name
  number, // source_system_id
  number // destination_system_id
];

type RegionRow = [
  number, // id
  string // name
];

type ConstellationRow = [
  number, // id
  string // name
];

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSystem, setHighlightedSystem] = useState<SolarSystem | null>(null);
  const [hoveredSystem, setHoveredSystem] = useState<SolarSystem | null>(null);
  const [isRegionHighlighterActive, setIsRegionHighlighterActive] = useState(false);

  // Refs for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const hoverPointRef = useRef<THREE.Points | null>(null);
  const stargateLinesRef = useRef<THREE.LineSegments | null>(null);
  const visibleSystemsRef = useRef<SolarSystem[]>([]);
  const animationRef = useRef({
    isAnimating: false,
    startTime: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    duration: 500, // ms
  });
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

  const stargateMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.05 }), []);

  // Fetch and process data from SQLite
  useEffect(() => {
    const loadDatabase = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `/${file}`
        });
        const response = await fetch('/map_data.db');
        const dbBytes = await response.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(dbBytes));

        // Query the database
        const systemsRes = db.exec("SELECT * FROM systems WHERE hidden = 0");
        const stargatesRes = db.exec("SELECT * FROM stargates");
        const regionsRes = db.exec("SELECT * FROM regions");
        const constellationsRes = db.exec("SELECT * FROM constellations");

        const solar_systems: { [key: string]: SolarSystem } = {};
        if (systemsRes.length > 0) {
            systemsRes[0].values.forEach((row) => {
                const typedRow = row as SystemRow;
                solar_systems[typedRow[0]] = {
                    id: typedRow[0],
                    name: typedRow[1],
                    position: { x: typedRow[7], y: typedRow[8], z: typedRow[9] },
                    region_id: typedRow[3],
                    constellation_id: typedRow[2],
                    planets: 0, // This data is not in the DB
                    hidden: typedRow[13]
                };
            });
        }

        const stargates: { [key: string]: Stargate } = {};
        if (stargatesRes.length > 0) {
            stargatesRes[0].values.forEach((row) => {
                const typedRow = row as StargateRow;
                stargates[typedRow[0]] = {
                    id: typedRow[0],
                    name: typedRow[1],
                    source_system_id: typedRow[2],
                    destination_system_id: typedRow[3]
                };
            });
        }
        
        const regions: { [key: string]: any } = {};
        if (regionsRes.length > 0) {
            regionsRes[0].values.forEach((row) => {
                const typedRow = row as RegionRow;
                regions[typedRow[0]] = {
                    id: typedRow[0],
                    name: typedRow[1],
                    // ... other region properties
                };
            });
        }

        const constellations: { [key: string]: any } = {};
        if (constellationsRes.length > 0) {
            constellationsRes[0].values.forEach((row) => {
                const typedRow = row as ConstellationRow;
                constellations[typedRow[0]] = {
                    id: typedRow[0],
                    name: typedRow[1],
                    // ... other constellation properties
                };
            });
        }

        setMapData({ solar_systems, stargates, regions, constellations });

      } catch (error) {
        console.error('Error loading map data:', error);
      }
    };

    loadDatabase();
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
    cameraRef.current = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000000);
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    currentMount.appendChild(rendererRef.current.domElement);

    const controls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;
    
    cameraRef.current.position.z = 5000;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0);
    sceneRef.current.add(directionalLight);

    // Hover Point
    const hoverGeometry = new THREE.BufferGeometry();
    hoverGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const hoverMaterial = new THREE.PointsMaterial({
      size: 20, // Default/min size
      sizeAttenuation: false, // Use screen-space sizing
      map: ringTexture,
      color: 0xff4c26,
      transparent: true,
      alphaTest: 0.5,
    });
    hoverPointRef.current = new THREE.Points(hoverGeometry, hoverMaterial);
    hoverPointRef.current.visible = false;
    sceneRef.current.add(hoverPointRef.current);

    const animate = () => {
      requestAnimationFrame(animate);
      const anim = animationRef.current;
      if (anim.isAnimating) {
        const now = Date.now();
        const progress = Math.min((now - anim.startTime) / anim.duration, 1);
        cameraRef.current?.position.lerpVectors(anim.startPos, anim.endPos, progress);
        controlsRef.current?.target.lerpVectors(anim.startTarget, anim.endTarget, progress);
        if (progress >= 1) {
          anim.isAnimating = false;
        }
      }
      controls.update();
      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
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
      rendererRef.current?.dispose();
      currentMount.removeChild(rendererRef.current!.domElement);
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

    if (stargateLinesRef.current) {
      sceneRef.current.remove(stargateLinesRef.current);
      stargateLinesRef.current.geometry.dispose();
    }

    const stargateVertices: number[] = [];
    if (mapData.stargates) {
      Object.values(mapData.stargates).forEach((stargate) => {
        const sourceSystem = mapData.solar_systems[stargate.source_system_id];
        const destinationSystem = mapData.solar_systems[stargate.destination_system_id];
        if (sourceSystem && destinationSystem && sourceSystem.position && destinationSystem.position && !sourceSystem.hidden && !destinationSystem.hidden) {
          const sourcePos = getTransformedPosition(sourceSystem.position);
          const destPos = getTransformedPosition(destinationSystem.position);
          stargateVertices.push(sourcePos.x, sourcePos.y, sourcePos.z);
          stargateVertices.push(destPos.x, destPos.y, destPos.z);
        }
      });
      const stargateGeometry = new THREE.BufferGeometry();
      stargateGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stargateVertices, 3));
      const stargateLines = new THREE.LineSegments(stargateGeometry, stargateMaterial);
      sceneRef.current?.add(stargateLines);
      stargateLinesRef.current = stargateLines;
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
    if (!highlightedSystem || !controlsRef.current || !cameraRef.current) return;

    const anim = animationRef.current;
    if (!anim.isAnimating) {
      anim.isAnimating = true;
      anim.startTime = Date.now();
      anim.startPos.copy(cameraRef.current.position);
      anim.startTarget.copy(controlsRef.current.target);

      const newTarget = new THREE.Vector3();
      const transformedPos = getTransformedPosition(highlightedSystem.position);
      newTarget.set(transformedPos.x, transformedPos.y, transformedPos.z);
      anim.endTarget.copy(newTarget);

      const offset = new THREE.Vector3().subVectors(anim.startPos, anim.startTarget);
      anim.endPos.copy(newTarget).add(offset);
    }
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
  }, [hoveredSystem, starFieldRef.current]);

  // Handle Region Highlighter Module
  useEffect(() => {
    if (mapData && starFieldRef.current) {
      if (isRegionHighlighterActive) {
        RegionHighlighterModule.init(sceneRef.current!, mapData, starFieldRef.current);
      } else {
        RegionHighlighterModule.cleanup(starFieldRef.current);
      }
    }
    // Cleanup on component unmount
    return () => {
      if (mapData && starFieldRef.current) {
        RegionHighlighterModule.cleanup(starFieldRef.current);
      }
    };
  }, [isRegionHighlighterActive, mapData]);

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
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>
        <div>
          <input
            type="text"
            placeholder="Search for a system..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            style={{ padding: '5px' }}
          />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label>
            <input
              type="checkbox"
              checked={isRegionHighlighterActive}
              onChange={(e) => setIsRegionHighlighterActive(e.target.checked)}
            />
            Highlight 'Restrained Element'
          </label>
        </div>
      </div>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}

export default App;
