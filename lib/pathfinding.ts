import type { WorldPoint } from "@/lib/world-types";

const key = ({ x, y }: WorldPoint) => `${x},${y}`;
const distance = (a: WorldPoint, b: WorldPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function neighbors(point: WorldPoint, width: number, height: number) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ].filter(({ x, y }) => x >= 0 && y >= 0 && x < width && y < height);
}

export function findPath(blocked: readonly boolean[], width: number, height: number, start: WorldPoint, goal: WorldPoint): WorldPoint[] {
  const valid = (point: WorldPoint) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
  if (!valid(start) || !valid(goal) || blocked[goal.y * width + goal.x]) return [];
  if (start.x === goal.x && start.y === goal.y) return [start];

  const open: WorldPoint[] = [start];
  const cameFrom = new Map<string, WorldPoint>();
  const costs = new Map<string, number>([[key(start), 0]]);

  while (open.length) {
    open.sort((a, b) => (costs.get(key(a)) ?? Infinity) + distance(a, goal) - ((costs.get(key(b)) ?? Infinity) + distance(b, goal)));
    const current = open.shift()!;
    if (current.x === goal.x && current.y === goal.y) {
      const path = [current];
      let cursor = current;
      while (cameFrom.has(key(cursor))) {
        cursor = cameFrom.get(key(cursor))!;
        path.unshift(cursor);
      }
      return path;
    }
    for (const next of neighbors(current, width, height)) {
      if (blocked[next.y * width + next.x]) continue;
      const nextCost = (costs.get(key(current)) ?? 0) + 1;
      if (nextCost >= (costs.get(key(next)) ?? Infinity)) continue;
      costs.set(key(next), nextCost);
      cameFrom.set(key(next), current);
      if (!open.some((point) => point.x === next.x && point.y === next.y)) open.push(next);
    }
  }
  return [];
}

export function findPathToAdjacent(blocked: readonly boolean[], width: number, height: number, start: WorldPoint, target: WorldPoint) {
  return neighbors(target, width, height)
    .filter((point) => !blocked[point.y * width + point.x])
    .map((destination) => ({ destination, path: findPath(blocked, width, height, start, destination) }))
    .filter(({ path }) => path.length > 0)
    .sort((a, b) => a.path.length - b.path.length || distance(a.destination, start) - distance(b.destination, start))[0] ?? null;
}
