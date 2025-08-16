import * as THREE from 'three';
import type { StargateRow, RegionRow } from '../types/db';

// Define a simplified interface for what the module needs.
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
  stargates: { [key: string]: StargateRow };
  regions: { [key: string]: RegionRow };
}

interface Module {
  id: string;
  name: string;
  init: (
    scene: THREE.Scene,
    mapData: MapData,
    starField: THREE.Points,
    stargateLines: THREE.LineSegments | null,
    highlightedSystem: SolarSystem | null,
    visibleSystems: SolarSystem[] // New parameter
  ) => void;
  cleanup: (
    starField: THREE.Points,
    stargateLines: THREE.LineSegments | null,
    highlightedSystem: SolarSystem | null,
    visibleSystems: SolarSystem[]
  ) => void;
}

const HIGHLIGHT_COLOR_STARS = new THREE.Color(0xff4c26); // Orange for stars
const HIGHLIGHT_COLOR_GATES = new THREE.Color(0xcc5500); // Darker orange for stargates
const ORIGINAL_GATE_COLOR = new THREE.Color(0x444444); // Original stargate color
const SELECTED_STAR_COLOR = new THREE.Color(0xff4c26); // Red for selected star

let originalStarColors: Float32Array | null = null;
let originalStargateColors: Float32Array | null = null;

const RegionHighlighterModule: Module = {
  id: 'region-highlighter',
  name: 'Region Highlighter',

  init: (_scene, _mapData, starField, stargateLines, highlightedSystem, visibleSystems) => {
    if (!starField) {
      return;
    }

    const starGeometry = starField.geometry as THREE.BufferGeometry;
    const starColors = starGeometry.attributes.color as THREE.BufferAttribute;

    // Ensure starColors.array exists before trying to use it
    if (starColors && starColors.array) {
      // Always re-initialize originalStarColors with the current starField's colors
      // This handles cases where starField might have been re-created or disposed
      originalStarColors = new Float32Array(starColors.array);
    } else {
      return; // Cannot proceed without star colors
    }

    let stargateColors: THREE.BufferAttribute | null = null;
    if (stargateLines) {
      const stargateGeometry = stargateLines.geometry as THREE.BufferGeometry;
      stargateColors = stargateGeometry.attributes.color as THREE.BufferAttribute;
      if (stargateColors && stargateColors.array) {
        originalStargateColors = new Float32Array(stargateColors.array);
      } else {
        // Continue without stargate highlighting if colors are missing
      }
    }

    const targetRegionId = highlightedSystem!.region_id;

    const systemsInRegion: { [id: number]: SolarSystem } = {};
    visibleSystems.forEach((system) => {
      if (system.region_id === targetRegionId) {
        systemsInRegion[system.id] = system;
        // Highlight star
        const index = visibleSystems.findIndex(s => s.id === system.id);
        if (index !== -1) {
          HIGHLIGHT_COLOR_STARS.toArray(starColors.array, index * 3);
        } else {
        }
      }
    });

    // Highlight stargates within the region
    if (stargateLines && stargateColors) {
      const stargateData = stargateLines.geometry.userData.stargateData;

      for (let i = 0; i < stargateData.length; i++) {
        const stargate = stargateData[i];
        if (systemsInRegion[stargate.source_system_id] && systemsInRegion[stargate.destination_system_id]) {
          // Both source and destination systems are in the highlighted region
          HIGHLIGHT_COLOR_GATES.toArray(stargateColors.array, i * 2 * 3);
          HIGHLIGHT_COLOR_GATES.toArray(stargateColors.array, (i * 2 + 1) * 3);
        } else {
          // Ensure non-highlighted gates are original color
          ORIGINAL_GATE_COLOR.toArray(stargateColors.array, i * 2 * 3);
          ORIGINAL_GATE_COLOR.toArray(stargateColors.array, (i * 2 + 1) * 3);
        }
      }
      stargateColors.needsUpdate = true;
    }

    starColors.needsUpdate = true;
  },

  cleanup: (starField, stargateLines, highlightedSystem, visibleSystems) => {
    if (starField && originalStarColors) {
      const starColors = (starField.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
      // Only reset if starColors.array is still valid
      if (starColors && starColors.array) {
        starColors.array.set(originalStarColors);
        
        // If a system is still highlighted, keep it colored
        if (highlightedSystem) {
          const highlightedIndex = visibleSystems.findIndex(s => s.id === highlightedSystem.id);
          if (highlightedIndex !== -1) {
            SELECTED_STAR_COLOR.toArray(starColors.array, highlightedIndex * 3);
          }
        }
        
        starColors.needsUpdate = true;
      } else {
      }
    }

    if (stargateLines && originalStargateColors) {
      const stargateColors = (stargateLines.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
      // Only reset if stargateColors.array is still valid
      if (stargateColors && stargateColors.array) {
        stargateColors.array.set(originalStargateColors);
        stargateColors.needsUpdate = true;
      } else {
      }
    }
  },
};

export default RegionHighlighterModule;