import type { WorldDefinition, WorldField, WorldPoint, WorldRect } from "@/lib/world-types";
type Grid = Pick<WorldDefinition, "width" | "height" | "pixelWidth" | "pixelHeight">;

export function worldToCell(grid: Grid, point: WorldPoint): WorldPoint {
  return { x: Math.max(0, Math.min(grid.width - 1, Math.floor(point.x / grid.pixelWidth * grid.width))), y: Math.max(0, Math.min(grid.height - 1, Math.floor(point.y / grid.pixelHeight * grid.height))) };
}
// Fractional cells also convert, for movement interpolation.
export function cellToWorld(grid: Grid, point: WorldPoint): WorldPoint {
  return { x: (point.x + 0.5) * grid.pixelWidth / grid.width, y: (point.y + 0.5) * grid.pixelHeight / grid.height };
}
export function displayedToWorld(grid: Grid, bounds: WorldRect, point: WorldPoint): WorldPoint {
  return { x: (point.x - bounds.x) / bounds.width * grid.pixelWidth, y: (point.y - bounds.y) / bounds.height * grid.pixelHeight };
}
export function fieldCell(field: WorldField, column: number, row: number): WorldRect {
  if (column < 0 || column >= field.columns || row < 0 || row >= field.rows) throw new Error("Field cell outside bounds");
  return { x: field.x + column * field.width / field.columns, y: field.y + row * field.height / field.rows, width: field.width / field.columns, height: field.height / field.rows };
}
export function pointInPolygon(point: WorldPoint, polygon: WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
