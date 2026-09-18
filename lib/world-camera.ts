import type { WorldPoint } from "@/lib/world-types";

export type CameraMode = "overview" | "follow";
export type CameraViewport = { width: number; height: number };
export type WorldCamera = { scale: number; x: number; y: number };

const FOLLOW_ZOOM = 1.6;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function getOverviewCamera(worldWidth: number, worldHeight: number, viewport: CameraViewport): WorldCamera {
  if (viewport.width <= 0 || viewport.height <= 0) return { scale: 1, x: 0, y: 0 };
  const scale = Math.min(viewport.width / worldWidth, viewport.height / worldHeight);
  return {
    scale,
    x: (viewport.width - worldWidth * scale) / 2,
    y: (viewport.height - worldHeight * scale) / 2,
  };
}

export function getFollowCamera(worldWidth: number, worldHeight: number, viewport: CameraViewport, target: WorldPoint): WorldCamera {
  if (viewport.width <= 0 || viewport.height <= 0) return { scale: 1, x: 0, y: 0 };

  const fitScale = Math.min(viewport.width / worldWidth, viewport.height / worldHeight);
  const coverScale = Math.max(viewport.width / worldWidth, viewport.height / worldHeight);
  const scale = Math.max(fitScale * FOLLOW_ZOOM, coverScale);
  const minimumX = viewport.width - worldWidth * scale;
  const minimumY = viewport.height - worldHeight * scale;

  return {
    scale,
    x: clamp(viewport.width / 2 - target.x * scale, minimumX, 0),
    y: clamp(viewport.height / 2 - target.y * scale, minimumY, 0),
  };
}

export function screenToCanonicalWorld(camera: WorldCamera, viewportOrigin: WorldPoint, screenPoint: WorldPoint): WorldPoint {
  return {
    x: (screenPoint.x - viewportOrigin.x - camera.x) / camera.scale,
    y: (screenPoint.y - viewportOrigin.y - camera.y) / camera.scale,
  };
}
