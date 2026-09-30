import type { WorldPoint } from "@/lib/world-types";

export type CameraMode = "overview" | "follow";
export type CameraViewport = { width: number; height: number };
export type WorldCamera = { scale: number; x: number; y: number };
export type CameraOffset = { x: number; y: number };

export const CAMERA_MIN_ZOOM = 0.75;
export const CAMERA_MAX_ZOOM = 1.6;
export const FOLLOW_ZOOM = 1.6;
export const CAMERA_DRAG_THRESHOLD = 6;

export function isCameraDrag(distance: number, pointerCount: number) {
  return pointerCount > 1 || distance > CAMERA_DRAG_THRESHOLD;
}

export function createCameraClickGuard() {
  const pointerIds = new Set<number>();
  return {
    mark(ids: Iterable<number>) {
      for (const id of ids) pointerIds.add(id);
    },
    consume(pointerId?: number) {
      if (pointerId !== undefined && !pointerIds.has(pointerId)) return false;
      const id = pointerId ?? pointerIds.values().next().value;
      if (id === undefined) return false;
      pointerIds.delete(id);
      return true;
    },
    clear(pointerId: number) {
      pointerIds.delete(pointerId);
    },
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function clampCameraZoom(zoom: number) {
  return clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
}

export function clampCameraZoomForMode(mode: CameraMode, zoom: number) {
  return mode === "overview" ? Math.max(1, clampCameraZoom(zoom)) : clampCameraZoom(zoom);
}

function clampAxis(offset: number, viewportSize: number, worldSize: number) {
  if (worldSize <= viewportSize) return (viewportSize - worldSize) / 2;
  return clamp(offset, viewportSize - worldSize, 0);
}

export function clampCamera(worldWidth: number, worldHeight: number, viewport: CameraViewport, camera: WorldCamera): WorldCamera {
  return {
    ...camera,
    x: clampAxis(camera.x, viewport.width, worldWidth * camera.scale),
    y: clampAxis(camera.y, viewport.height, worldHeight * camera.scale),
  };
}

export function getOverviewCamera(worldWidth: number, worldHeight: number, viewport: CameraViewport, zoom = 1, pan: CameraOffset = { x: 0, y: 0 }): WorldCamera {
  if (viewport.width <= 0 || viewport.height <= 0) return { scale: 1, x: 0, y: 0 };
  const fitScale = Math.min(viewport.width / worldWidth, viewport.height / worldHeight);
  // Overview never zooms below the existing whole-map view.
  const scale = fitScale * clampCameraZoomForMode("overview", zoom);
  return clampCamera(worldWidth, worldHeight, viewport, {
    scale,
    x: (viewport.width - worldWidth * scale) / 2 + pan.x,
    y: (viewport.height - worldHeight * scale) / 2 + pan.y,
  });
}

export function getFollowCamera(worldWidth: number, worldHeight: number, viewport: CameraViewport, target: WorldPoint, zoom = 1, pan: CameraOffset = { x: 0, y: 0 }): WorldCamera {
  if (viewport.width <= 0 || viewport.height <= 0) return { scale: 1, x: 0, y: 0 };

  const fitScale = Math.min(viewport.width / worldWidth, viewport.height / worldHeight);
  const coverScale = Math.max(viewport.width / worldWidth, viewport.height / worldHeight);
  const scale = Math.max(fitScale * FOLLOW_ZOOM * clampCameraZoom(zoom), coverScale);

  return clampCamera(worldWidth, worldHeight, viewport, {
    scale,
    x: viewport.width / 2 - target.x * scale + pan.x,
    y: viewport.height / 2 - target.y * scale + pan.y,
  });
}

export function cameraOffsetForAnchor(baseCamera: WorldCamera, anchorWorld: WorldPoint, anchorScreen: WorldPoint): CameraOffset {
  return {
    x: anchorScreen.x - anchorWorld.x * baseCamera.scale - baseCamera.x,
    y: anchorScreen.y - anchorWorld.y * baseCamera.scale - baseCamera.y,
  };
}

export function screenToCanonicalWorld(camera: WorldCamera, viewportOrigin: WorldPoint, screenPoint: WorldPoint): WorldPoint {
  return {
    x: (screenPoint.x - viewportOrigin.x - camera.x) / camera.scale,
    y: (screenPoint.y - viewportOrigin.y - camera.y) / camera.scale,
  };
}
