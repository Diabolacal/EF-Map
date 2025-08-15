export interface SystemRow {
  id: number;
  name: string;
  constellation_id: number;
  region_id: number;
  x: number;
  y: number;
  z: number;
  hidden: boolean;
}

export interface StargateRow {
  id: number;
  name: string;
  source_system_id: number;
  destination_system_id: number;
}

export interface RegionRow {
  id: number;
  name: string;
}

export interface ConstellationRow {
  id: number;
  name: string;
}