import { cellToWorld, fieldCell, pointInPolygon, worldToCell } from "@/lib/world-coordinates";
import type { CollisionRegion, WorldBuilding, WorldDefinition, WorldField } from "@/lib/world-types";

const geometry = { width: 45, height: 34, pixelWidth: 1447, pixelHeight: 1087 };
const polygon = (name: string, coordinates: number[][]): CollisionRegion => ({ name, points: coordinates.map(([x, y]) => ({ x, y })) });
const rectangle = (name: string, x: number, y: number, right: number, bottom: number) => polygon(name, [[x, y], [right, y], [right, bottom], [x, bottom]]);
export const WORLD_FIELDS: WorldField[] = [
  { id: "left", x: 382, y: 290, width: 225, height: 246, columns: 8, rows: 9 },
  { id: "right", x: 842, y: 290, width: 226, height: 246, columns: 8, rows: 9 },
];
const buildings: WorldBuilding[] = [
  { id: "seed-shop", label: "Seed Store", x: 45, y: 45, width: 265, height: 190, entrance: { x: 178, y: 250 } },
  { id: "market", label: "Market", x: 1145, y: 40, width: 230, height: 190, entrance: { x: 1300, y: 250 } },
  { id: "farmhouse", label: "Farmhouse", x: 635, y: 292, width: 175, height: 190, entrance: { x: 728, y: 500 } },
  { id: "dungeon", label: "Dungeon", x: 155, y: 700, width: 195, height: 140, entrance: { x: 245, y: 850 } },
  { id: "lake", label: "Lake dock", x: 1010, y: 705, width: 175, height: 80, entrance: { x: 1085, y: 760 } },
  { id: "world-exit", label: "World / Friends", x: 685, y: 65, width: 80, height: 80, entrance: { x: 725, y: 100 } },
];
// Coarse silhouettes in image pixels; bridges/docks/paths override these below.
export const BLOCKED_REGIONS: CollisionRegion[] = [
  ...buildings.filter((b) => !["lake", "world-exit"].includes(b.id)).map((b) => rectangle(b.id, b.x, b.y, b.x + b.width, b.y + b.height)),
  rectangle("northwest forest", 0, 0, 155, 70),
  polygon("western river and cliffs", [[255,0],[397,0],[443,179],[386,259],[350,365],[295,470],[203,509],[0,455],[0,390],[218,412],[279,335],[322,240],[326,138]]),
  rectangle("north central forest", 398, 0, 677, 169),
  rectangle("north gate right wall", 781, 10, 870, 169),
  rectangle("north gate left wall", 571, 10, 670, 169),
  rectangle("northeast forest", 850, 0, 1135, 204),
  rectangle("east forest", 1360, 240, 1447, 450),
  rectangle("east path trees", 1190, 401, 1318, 564),
  rectangle("west trees", 0, 270, 75, 382),
  rectangle("west field trees", 263, 456, 348, 553),
  rectangle("field east tree", 1080, 278, 1148, 352),
  rectangle("house north tree", 780, 260, 838, 328),
  rectangle("north garden fence", 986, 217, 1095, 265),
  rectangle("gate side fence", 850, 151, 920, 186),
  rectangle("lake north fence", 927, 635, 1016, 685),
  polygon("lake and shoreline", [[1280,452],[1447,430],[1447,1087],[974,1087],[906,955],[877,881],[850,819],[863,738],[920,696],[978,677],[1184,685],[1221,563]]),
  rectangle("southern central trees", 766, 647, 901, 753),
  rectangle("southern grove", 783, 916, 933, 1087),
  polygon("dungeon cliffs and corruption", [[0,585],[208,582],[279,632],[389,633],[601,752],[647,855],[604,1087],[0,1087]]),
];
export const WALKABLE_REGIONS: CollisionRegion[] = [
  rectangle("seed bridge", 275, 293, 357, 366),
  rectangle("west bridge", 129, 386, 193, 496),
  polygon("dungeon approach", [[300,606],[374,606],[374,685],[421,726],[482,775],[486,859],[434,910],[371,948],[362,1002],[304,1002],[301,951],[235,928],[196,901],[195,842],[266,842],[256,887],[312,913],[350,909],[417,861],[421,806],[378,768],[341,730],[309,703]]),
  rectangle("dungeon doorway apron", 210, 833, 279, 875),
  rectangle("dock approach", 1029, 612, 1139, 716),
  rectangle("dock deck", 1008, 704, 1186, 747),
  rectangle("dock end", 1023, 735, 1105, 798),
];
function fieldBlock(fieldIndex: number, columnStart: number, columnEnd: number, rowStart: number, rowEnd: number) {
  const cells: Array<{ fieldIndex: number; column: number; row: number }> = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let column = columnStart; column <= columnEnd; column += 1) cells.push({ fieldIndex, column, row });
  }
  return cells;
}

const farmUnlockOrder = [
  fieldBlock(0, 0, 2, 6, 8),
  fieldBlock(0, 0, 2, 3, 5),
  fieldBlock(0, 0, 2, 0, 2),
  fieldBlock(0, 3, 5, 0, 2),
  fieldBlock(0, 3, 5, 3, 8),
  fieldBlock(0, 6, 7, 0, 8),
  fieldBlock(1, 0, 1, 0, 8),
  fieldBlock(1, 2, 3, 0, 8),
  fieldBlock(1, 4, 5, 0, 8),
  fieldBlock(1, 6, 7, 0, 8),
].flat();

export const WORLD_FARM_PLOTS = farmUnlockOrder.map(({ fieldIndex, column, row }, id) => {
  const bounds = fieldCell(WORLD_FIELDS[fieldIndex], column, row);
  return { id, ...bounds, approach: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } };
});
const blocked = Array.from({ length: geometry.width * geometry.height }, (_, index) => {
  const center = cellToWorld(geometry, { x: index % geometry.width, y: Math.floor(index / geometry.width) });
  const terrainBlocked = BLOCKED_REGIONS.some((region) => pointInPolygon(center, region.points));
  const exception = WALKABLE_REGIONS.some((region) => pointInPolygon(center, region.points));
  return terrainBlocked && !exception;
});
export const FIRST_WORLD: WorldDefinition = {
  ...geometry, background: "/assets/official-farm-map/sprout-village.png",
  start: worldToCell(geometry, { x: 725, y: 590 }), buildings, farmPlots: WORLD_FARM_PLOTS, blocked,
};
