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

// Define a simplified interface for what the module needs.
interface MapData {
  solar_systems: { [key: string]: SolarSystem };
}

interface Module {
  id: string;
  name: string;
  init: (scene: THREE.Scene, mapData: MapData, starField: THREE.Points) => void;
  cleanup: (starField: THREE.Points) => void;
}

const REGION_TO_HIGHLIGHT = 10000014; // Restrained Element
const HIGHLIGHT_COLOR = new THREE.Color(0x00ff00); // Green

let originalColors: Float32Array | null = null;

const RegionHighlighterModule: Module = {
  id: 'region-highlighter',
  name: 'Region Highlighter',

  init: (_scene, mapData, starField) => {
    if (!starField) return;

    const geometry = starField.geometry as THREE.BufferGeometry;
    const colors = geometry.attributes.color as THREE.BufferAttribute;
    originalColors = new Float32Array(colors.array);

    const systems = Object.values(mapData.solar_systems);
    const visibleSystems = systems.filter(s => s && s.position && !s.hidden);

    visibleSystems.forEach((system, index) => {
      if (system.region_id === REGION_TO_HIGHLIGHT) {
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

export default RegionHighlighterModule;
