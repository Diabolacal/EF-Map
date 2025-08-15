import * as THREE from 'three';

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

interface MapData {
  solar_systems: { [key: string]: SolarSystem };
}

interface Module {
  id: string;
  name: string;
  init: (scene: THREE.Scene, mapData: MapData, starField: THREE.Points) => void;
  cleanup: (starField: THREE.Points) => void;
}

const HIGHLIGHT_COLOR = new THREE.Color(0xff0000); // Red

let originalColors: Float32Array | null = null;
let visitedSystemIds: string[] = [];

async function fetchVisitedSystemIds(): Promise<string[]> {
  try {
    const response = await fetch('/SolarSystems Jumps - Frontier.csv');
    const text = await response.text();
    const lines = text.split('\n').slice(1); // Skip header
    const systemIds = lines.map(line => line.split(',')[0]).filter(id => id);
    return systemIds;
  } catch (error) {
    console.error('Error loading visited systems CSV:', error);
    return [];
  }
}

const VisitedSystemsModule: Module = {
  id: 'visited-systems-highlighter',
  name: 'Visited Systems Highlighter',

  init: async (_scene, mapData, starField) => {
    if (!starField) return;

    visitedSystemIds = await fetchVisitedSystemIds();

    const geometry = starField.geometry as THREE.BufferGeometry;
    const colors = geometry.attributes.color as THREE.BufferAttribute;
    originalColors = new Float32Array(colors.array);

    const systems = Object.values(mapData.solar_systems);
    const visibleSystems = systems.filter(s => s && s.position && !s.hidden);

    visibleSystems.forEach((system, index) => {
      if (visitedSystemIds.includes(system.id.toString())) {
        HIGHLIGHT_COLOR.toArray(colors.array, index * 3);
      }
    });

    colors.needsUpdate = true;
  },

  cleanup: (starField) => {
    if (!starField || !originalColors) return;

    const geometry = starField.geometry as THREE.BufferGeometry;
    const colors = geometry.attributes.color as THREE.BufferAttribute;
    colors.array.set(originalColors);
    colors.needsUpdate = true;
    originalColors = null;
  },
};

export default VisitedSystemsModule;