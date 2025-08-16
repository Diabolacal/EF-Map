import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import './App.css';
import RegionHighlighterModule from './modules/RegionHighlighter';
import { openDbFromArrayBuffer } from "./lib/sql";
import type { SystemRow, StargateRow, RegionRow, ConstellationRow } from "./types/db";

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
    context.lineWidth = 8;
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
  regions: { [key: string]: RegionRow };
  constellations: { [key: string]: ConstellationRow };
}

type SqlValue = number | string | Uint8Array | null;


function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSystem, setHighlightedSystem] = useState<SolarSystem | null>(null);
  const [hoveredSystem, setHoveredSystem] = useState<SolarSystem | null>(null);
  const [isRegionHighlighterActive, setIsRegionHighlighterActive] = useState(false);

  // New state for labels
  const hoverLabelObj = useRef<CSS2DObject | null>(null);
  const selectedLabelObj = useRef<CSS2DObject | null>(null);
  const selectedStar = useRef<THREE.Object3D | null>(null);

  // Helper to create label elements
  const createSystemLabelElement = useCallback((name: string, isPersistent = false): HTMLDivElement => {
    const wrapper = document.createElement('div');          // This becomes CSS2DObject.element
    wrapper.className = 'system-label-wrapper';
    wrapper.style.pointerEvents = 'none';

    const inner = document.createElement('div');            // Visible box
    inner.className = isPersistent ? 'system-label system-label--selected' : 'system-label';
    inner.textContent = name;

    wrapper.appendChild(inner);

    return wrapper;
  }, []);

  // Helper to get system name
    // Helper to get system name
  const getSystemName = useCallback((obj: THREE.Object3D): string | null => {
    if (obj && obj.userData && obj.userData.name) {
      return obj.userData.name;
    }
    return null;
  }, []);

  

  // Helper to set label text
  const setLabelText = (obj: CSS2DObject, txt: string) => {
    const inner = (obj.element as HTMLElement).querySelector('.system-label') as HTMLElement | null;
    if (inner) inner.textContent = txt;
  };

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

  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef(new THREE.Vector2());
  const mouseDownTimeRef = useRef(0);

  const circleTexture = useMemo(() => createCircleTexture(), []);
  const ringTexture = useMemo(() => createRingTexture(), []);

  const pointsMaterial = useMemo(() => {
    const material = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: true,
      map: circleTexture,
      transparent: true,
      alphaTest: 0.5,
      vertexColors: true,
    });

    material.onBeforeCompile = (shader) => {
      // Add a uniform for the maximum point size in pixels
      shader.uniforms.maxPointSize = { value: 10.0 };

      // Inject the uniform declaration into the shader
      shader.vertexShader = `
            uniform float maxPointSize;
            ${shader.vertexShader}
        `;

      // Replace the line where gl_PointSize is set to cap it
      shader.vertexShader = shader.vertexShader.replace(
        '#include <logdepthbuf_vertex>',
        `
            gl_PointSize = min(gl_PointSize, maxPointSize); // Cap to max pixel size
            #include <logdepthbuf_vertex>
            `
      );
    };
    return material;
  }, [circleTexture]);

  const stargateMaterial = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.05 }), []);

  // Fetch and process data from SQLite
  useEffect(() => {
    const loadDatabase = async () => {
      try {
        const response = await fetch('/map_data.db');
        const dbBytes = await response.arrayBuffer();
        const db = await openDbFromArrayBuffer(dbBytes);

        // Query the database
        const systemsRes = db.exec("SELECT * FROM systems WHERE hidden = 0");
        const stargatesRes = db.exec("SELECT * FROM stargates");
        const regionsRes = db.exec("SELECT * FROM regions");
        const constellationsRes = db.exec("SELECT * FROM constellations");

        const solar_systems: { [key: string]: SolarSystem } = {};
        if (systemsRes.length > 0) {
            systemsRes[0].values.forEach((row: SqlValue[]) => {
                const system: SystemRow = {
                    id: row[0] as number,
                    name: row[1] as string,
                    constellation_id: row[2] as number,
                    region_id: row[3] as number,
                    x: row[7] as number,
                    y: row[8] as number,
                    z: row[9] as number,
                    hidden: !!row[13]
                };
                solar_systems[system.id] = {
                    id: system.id,
                    name: system.name,
                    position: { x: system.x, y: system.y, z: system.z },
                    region_id: system.region_id,
                    constellation_id: system.constellation_id,
                    planets: 0,
                    hidden: system.hidden
                };
            });
        }

        const stargates: { [key: string]: Stargate } = {};
        if (stargatesRes.length > 0) {
            stargatesRes[0].values.forEach((row: SqlValue[]) => {
                const stargate: StargateRow = {
                    id: row[0] as number,
                    name: row[1] as string,
                    source_system_id: row[2] as number,
                    destination_system_id: row[3] as number
                };
                stargates[stargate.id] = {
                    id: stargate.id,
                    name: stargate.name,
                    source_system_id: stargate.source_system_id,
                    destination_system_id: stargate.destination_system_id
                };
            });
        }
        
        const regions: { [key: string]: RegionRow } = {};
        if (regionsRes.length > 0) {
            regionsRes[0].values.forEach((row: SqlValue[]) => {
                const region: RegionRow = {
                    id: row[0] as number,
                    name: row[1] as string
                };
                regions[region.id] = {
                    id: region.id,
                    name: region.name,
                    // ... other region properties
                };
            });
        }

        const constellations: { [key: string]: ConstellationRow } = {};
        if (constellationsRes.length > 0) {
            constellationsRes[0].values.forEach((row: SqlValue[]) => {
                const constellation: ConstellationRow = {
                    id: row[0] as number,
                    name: row[1] as string
                };
                constellations[constellation.id] = {
                    id: constellation.id,
                    name: constellation.name,
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

    // New: CSS2DRenderer setup
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none'; // Crucial for not blocking mouse events
    currentMount.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 10; // Add this line
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
      labelRenderer.render(sceneRef.current!, cameraRef.current!); // Render CSS2DRenderer
    };
    animate();

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight); // New: Resize label renderer
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      rendererRef.current?.dispose();
      currentMount.removeChild(rendererRef.current!.domElement);
      currentMount.removeChild(labelRenderer.domElement); // New: Clean up label renderer DOM
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
    const stargateColors: number[] = [];
    const defaultStargateColor = new THREE.Color(0x444444);
    const stargateData: { source_system_id: number, destination_system_id: number }[] = [];

    if (mapData.stargates) {
      Object.values(mapData.stargates).forEach((stargate) => {
        const sourceSystem = mapData.solar_systems[stargate.source_system_id];
        const destinationSystem = mapData.solar_systems[stargate.destination_system_id];
        if (sourceSystem && destinationSystem && sourceSystem.position && destinationSystem.position && !sourceSystem.hidden && !destinationSystem.hidden) {
          const sourcePos = getTransformedPosition(sourceSystem.position);
          const destPos = getTransformedPosition(destinationSystem.position);
          stargateVertices.push(sourcePos.x, sourcePos.y, sourcePos.z);
          stargateVertices.push(destPos.x, destPos.y, destPos.z);

          stargateColors.push(defaultStargateColor.r, defaultStargateColor.g, defaultStargateColor.b);
          stargateColors.push(defaultStargateColor.r, defaultStargateColor.g, defaultStargateColor.b);

          stargateData.push({ source_system_id: stargate.source_system_id, destination_system_id: stargate.destination_system_id });
        }
      });
      const stargateGeometry = new THREE.BufferGeometry();
      stargateGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stargateVertices, 3));
      stargateGeometry.setAttribute('color', new THREE.Float32BufferAttribute(stargateColors, 3));
      stargateGeometry.userData = { stargateData };

      const stargateLines = new THREE.LineSegments(stargateGeometry, stargateMaterial);
      sceneRef.current?.add(stargateLines);
      stargateLinesRef.current = stargateLines;
    }
  }, [mapData, getTransformedPosition, pointsMaterial, stargateMaterial]);

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

        // Adaptive sizing for hover ring, based on capped star size
        const MAX_STAR_PIXEL_SIZE = 10; // This is the capped size for stars
        const HOVER_RING_PADDING = 5; // Pixels of padding around the star
        const MIN_HOVER_RING_SIZE = 15; // Original minimum size for the ring

        // Calculate the new ring size, ensuring it's at least MIN_HOVER_RING_SIZE
        // and based on the capped star size plus padding.
        const newRingSize = Math.max(MIN_HOVER_RING_SIZE, MAX_STAR_PIXEL_SIZE + HOVER_RING_PADDING);
        
        (hoverPoint.material as THREE.PointsMaterial).size = newRingSize;

        hoverPoint.visible = true;
      } else {
        hoverPoint.visible = false;
      }
    }
  }, [hoveredSystem, getTransformedPosition, pointsMaterial]);

  const selectSystem = useCallback((system: SolarSystem) => {
    // Find the system's index in the visibleSystemsRef
    const systemIndex = visibleSystemsRef.current.findIndex(s => s.id === system.id);
    if (systemIndex === -1) return;

    // Get the position of the system
    const positionAttribute = starFieldRef.current!.geometry.attributes.position;
    const systemPosition = new THREE.Vector3();
    systemPosition.fromBufferAttribute(positionAttribute, systemIndex);

    // Clear previous selection
    if (selectedLabelObj.current && selectedLabelObj.current.parent) {
      selectedLabelObj.current.parent.remove(selectedLabelObj.current);
      if (sceneRef.current && selectedLabelObj.current.parent instanceof THREE.Object3D) {
        sceneRef.current.remove(selectedLabelObj.current.parent);
      }
    }

    // Create a new selected star object
    const newSelectedStarObject = new THREE.Object3D();
    newSelectedStarObject.position.copy(systemPosition);
    Object.assign(newSelectedStarObject.userData, { id: system.id });
    sceneRef.current?.add(newSelectedStarObject);
    selectedStar.current = newSelectedStarObject;

    // Create or update the label
    if (selectedLabelObj.current === null) {
      const el = createSystemLabelElement(system.name, true);
      selectedLabelObj.current = new CSS2DObject(el);
      selectedLabelObj.current.position.set(0, 0, 0);
      newSelectedStarObject.add(selectedLabelObj.current);
    } else {
      setLabelText(selectedLabelObj.current, system.name);
      selectedLabelObj.current.position.set(0, 0, 0);
      newSelectedStarObject.add(selectedLabelObj.current);
    }
    selectedLabelObj.current.visible = true;

    // Set the highlighted system for camera animation
    setHighlightedSystem(system);
  }, [createSystemLabelElement, setLabelText]);

  // Handle Pointer Events
  useEffect(() => {
    const currentRenderer = rendererRef.current;
    if (!currentRenderer) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const DRAG_THRESHOLD = 5; // pixels
    const CLICK_TIME_THRESHOLD = 200; // milliseconds

    const onPointerMove = (event: PointerEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      if (event.buttons & 1) { // Left mouse button is down
        const currentMousePos = new THREE.Vector2(event.clientX, event.clientY);
        if (currentMousePos.distanceTo(mouseDownPosRef.current) > DRAG_THRESHOLD) {
          isDraggingRef.current = true;
        }
      }

      if (!cameraRef.current || !starFieldRef.current || !controlsRef.current) {
        return;
      }

      if (!isDraggingRef.current) {
        raycaster.setFromCamera(mouse, cameraRef.current);
        // Dynamic threshold based on camera distance
        const distance = cameraRef.current.position.distanceTo(controlsRef.current.target);
        const minDistance = 100; // Adjust as needed
        const maxDistance = 50000; // Adjust as needed
        const minThreshold = 1; // Precise for zoomed in
        const maxThreshold = 300; // Forgiving for zoomed out
        const clampedDistance = Math.max(minDistance, Math.min(maxDistance, distance));
        const normalizedDistance = (clampedDistance - minDistance) / (maxDistance - minDistance);
        const dynamicThreshold = minThreshold + (maxThreshold - minThreshold) * normalizedDistance;
        raycaster.params.Points.threshold = dynamicThreshold;
        const intersects = raycaster.intersectObject(starFieldRef.current);

        let newHoveredSystem: SolarSystem | null = null;
        let hitStarObject: THREE.Object3D | null = null;

        if (intersects.length > 0 && intersects[0].index !== undefined) {
          newHoveredSystem = visibleSystemsRef.current[intersects[0].index];
          
          const intersectedPointPosition = new THREE.Vector3();
          const positionAttribute = starFieldRef.current.geometry.attributes.position;
          intersectedPointPosition.fromBufferAttribute(positionAttribute, intersects[0].index);
          hitStarObject = new THREE.Object3D(); // Create a dummy object to parent to
          hitStarObject.position.copy(intersectedPointPosition);
          sceneRef.current?.add(hitStarObject);

          setHoveredSystem(newHoveredSystem);

          if (hoverLabelObj.current === null) {
            const el = createSystemLabelElement(newHoveredSystem.name);
            hoverLabelObj.current = new CSS2DObject(el);
            hoverLabelObj.current.position.set(0, 0, 0); // Position at star's center, offset via CSS transform
            hitStarObject.add(hoverLabelObj.current);
          } else {
            if (hoverLabelObj.current.parent) {
              hoverLabelObj.current.parent.remove(hoverLabelObj.current);
              if (sceneRef.current && hoverLabelObj.current.parent instanceof THREE.Object3D) {
                sceneRef.current.remove(hoverLabelObj.current.parent);
              }
            }
            hitStarObject.add(hoverLabelObj.current);
            setLabelText(hoverLabelObj.current, newHoveredSystem.name);
            hoverLabelObj.current.position.set(0, 0, 0); // Reset offset
          }
          hoverLabelObj.current.visible = true;

        } else {
          setHoveredSystem(null);
          if (hoverLabelObj.current) {
            hoverLabelObj.current.visible = false;
            if (hoverLabelObj.current.parent) {
              hoverLabelObj.current.parent.remove(hoverLabelObj.current);
              if (sceneRef.current && hoverLabelObj.current.parent instanceof THREE.Object3D) {
                sceneRef.current.remove(hoverLabelObj.current.parent);
              }
            }
          }
        }
      } else if (isDraggingRef.current) {
        setHoveredSystem(null); // Clear hover when dragging
        if (hoverLabelObj.current) {
          hoverLabelObj.current.visible = false;
          if (hoverLabelObj.current.parent) {
            hoverLabelObj.current.parent.remove(hoverLabelObj.current);
            if (sceneRef.current && hoverLabelObj.current.parent instanceof THREE.Object3D) {
              sceneRef.current.remove(hoverLabelObj.current.parent);
            }
          }
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // Only care about left mouse button
      isDraggingRef.current = false;
      mouseDownPosRef.current.set(event.clientX, event.clientY);
      mouseDownTimeRef.current = Date.now();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return; // Only care about left mouse button

      const timeElapsed = Date.now() - mouseDownTimeRef.current;

      if (!isDraggingRef.current && timeElapsed < CLICK_TIME_THRESHOLD) {
        // It was a click, not a drag
        if (hoveredSystem) {
          selectSystem(hoveredSystem);
        }
      }
      isDraggingRef.current = false; // Reset drag state
    };

    currentRenderer.domElement.addEventListener('pointermove', onPointerMove);
    currentRenderer.domElement.addEventListener('pointerdown', onPointerDown);
    currentRenderer.domElement.addEventListener('pointerup', onPointerUp);

    return () => {
      currentRenderer.domElement.removeEventListener('pointermove', onPointerMove);
      currentRenderer.domElement.removeEventListener('pointerdown', onPointerDown);
      currentRenderer.domElement.removeEventListener('pointerup', onPointerUp);
    };
    }, [hoveredSystem, isDraggingRef, mouseDownPosRef, mouseDownTimeRef, createSystemLabelElement, getSystemName, selectSystem]);

  // Handle Region Highlighter Module
  useEffect(() => {
    if (!mapData || !starFieldRef.current) return;

    if (isRegionHighlighterActive && highlightedSystem) { // Only init if active AND a system is highlighted
      RegionHighlighterModule.init(
        sceneRef.current!,
        mapData,
        starFieldRef.current,
        stargateLinesRef.current,
        highlightedSystem,
        visibleSystemsRef.current
      );
    } else { // Cleanup if not active or no system is highlighted
      RegionHighlighterModule.cleanup(
        starFieldRef.current,
        stargateLinesRef.current,
        highlightedSystem,
        visibleSystemsRef.current
      );
    }

    // Cleanup on component unmount or when isRegionHighlighterActive becomes false
    return () => {
      if (mapData && starFieldRef.current) {
        RegionHighlighterModule.cleanup(
          starFieldRef.current,
          stargateLinesRef.current,
          highlightedSystem,
          visibleSystemsRef.current
        );
      }
    };
  }, [isRegionHighlighterActive, mapData, highlightedSystem]); // Add highlightedSystem to dependencies

  const handleSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && mapData) {
      const query = searchQuery.toLowerCase();
      const foundSystem = Object.values(mapData.solar_systems).find(
        (system) => system.name.toLowerCase() === query
      );
      if (foundSystem) {
        selectSystem(foundSystem);
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
              onChange={(e) => {
                setIsRegionHighlighterActive(e.target.checked);
              }}
            />
            Highlight Region
          </label>
        </div>
      </div>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}

export default App;

