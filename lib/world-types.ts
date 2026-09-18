export type WorldPoint = { x: number; y: number };
export type WorldRect = WorldPoint & { width: number; height: number };
export type WorldBuildingId = "farmhouse" | "seed-shop" | "market" | "dungeon" | "lake" | "world-exit";
export type WorldBuilding = WorldRect & { id: WorldBuildingId; label: string; entrance: WorldPoint };
export type WorldField = WorldRect & { id: string; columns: number; rows: number };
export type WorldFarmPlot = WorldRect & { id: number; approach: WorldPoint };
export type CollisionRegion = { name: string; points: WorldPoint[] };
export type WorldDefinition = {
  width: number; height: number; pixelWidth: number; pixelHeight: number;
  background: string; start: WorldPoint; blocked: boolean[];
  buildings: WorldBuilding[]; farmPlots: WorldFarmPlot[];
};
