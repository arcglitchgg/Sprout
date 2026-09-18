"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findPath } from "@/lib/pathfinding";
import { FARMER_ANIMATION } from "@/lib/sprite-data";
import type { WorldDefinition, WorldPoint } from "@/lib/world-types";

export const MOVEMENT_TILES_PER_SECOND = 8;

export type WorldMovementState = {
  position: WorldPoint;
  tile: WorldPoint;
  facing: "left" | "right";
  moving: boolean;
  frame: number;
};

type WorldMovementOptions = {
  initialTile?: WorldPoint;
  initialFacing?: "left" | "right";
  onSettled?: (tile: WorldPoint, facing: "left" | "right") => void;
};

export function useWorldMovement(world: WorldDefinition, options: WorldMovementOptions = {}) {
  const requestedTile = options.initialTile;
  const initialTile = requestedTile && Number.isInteger(requestedTile.x) && Number.isInteger(requestedTile.y) && requestedTile.x >= 0 && requestedTile.y >= 0 && requestedTile.x < world.width && requestedTile.y < world.height && !world.blocked[requestedTile.y * world.width + requestedTile.x]
    ? requestedTile
    : world.start;
  const initialFacing = options.initialFacing === "left" ? "left" : "right";
  const tile = useRef({ ...initialTile });
  const position = useRef({ ...initialTile });
  const route = useRef<WorldPoint[]>([]);
  const queuedDestination = useRef<WorldPoint | null>(null);
  const arrivalCallback = useRef<(() => void) | null>(null);
  const facing = useRef<"left" | "right">(initialFacing);
  const onSettled = useRef(options.onSettled);
  const frameIndex = useRef(0);
  const frameElapsed = useRef(0);
  const [state, setState] = useState<WorldMovementState>({ position: { ...initialTile }, tile: { ...initialTile }, facing: initialFacing, moving: false, frame: FARMER_ANIMATION.idleFrame });

  useEffect(() => {
    onSettled.current = options.onSettled;
  }, [options.onSettled]);

  const buildRoute = useCallback((destination: WorldPoint) => {
    route.current = findPath(world.blocked, world.width, world.height, tile.current, destination).slice(1);
    return route.current.length > 0;
  }, [world]);

  const cancelInteraction = useCallback(() => {
    arrivalCallback.current = null;
  }, []);

  const moveTo = useCallback((destination: WorldPoint, onArrival?: () => void) => {
    arrivalCallback.current = onArrival ?? null;
    if (route.current.length) {
      queuedDestination.current = destination;
      return;
    }
    if (!buildRoute(destination)) {
      const callback = arrivalCallback.current;
      arrivalCallback.current = null;
      if (tile.current.x === destination.x && tile.current.y === destination.y) {
        callback?.();
        onSettled.current?.({ ...tile.current }, facing.current);
      }
    }
  }, [buildRoute]);

  useEffect(() => {
    let animationId = 0;
    let lastTime = performance.now();
    const tick = (time: number) => {
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const next = route.current[0];
      if (next) {
        const dx = next.x - position.current.x;
        const dy = next.y - position.current.y;
        if (dx > 0) facing.current = "right";
        if (dx < 0) facing.current = "left";
        const remaining = Math.hypot(dx, dy);
        const step = MOVEMENT_TILES_PER_SECOND * deltaSeconds;
        if (remaining <= step) {
          position.current = { ...next };
          tile.current = { ...next };
          route.current.shift();
          if (queuedDestination.current) {
            const destination = queuedDestination.current;
            queuedDestination.current = null;
            if (!buildRoute(destination)) {
              const callback = arrivalCallback.current;
              arrivalCallback.current = null;
              if (tile.current.x === destination.x && tile.current.y === destination.y) {
                callback?.();
                onSettled.current?.({ ...tile.current }, facing.current);
              }
            }
          } else if (!route.current.length) {
            const callback = arrivalCallback.current;
            arrivalCallback.current = null;
            callback?.();
            onSettled.current?.({ ...tile.current }, facing.current);
          }
        } else {
          position.current = { x: position.current.x + dx / remaining * step, y: position.current.y + dy / remaining * step };
        }
        frameElapsed.current += deltaSeconds * 1000;
        if (frameElapsed.current >= FARMER_ANIMATION.frameMs) {
          frameElapsed.current %= FARMER_ANIMATION.frameMs;
          frameIndex.current = (frameIndex.current + 1) % FARMER_ANIMATION.walkFrames.length;
        }
      } else {
        frameIndex.current = 0;
        frameElapsed.current = 0;
      }
      const moving = route.current.length > 0;
      setState({ position: { ...position.current }, tile: { ...tile.current }, facing: facing.current, moving, frame: moving ? FARMER_ANIMATION.walkFrames[frameIndex.current] : FARMER_ANIMATION.idleFrame });
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [buildRoute]);

  return { state, moveTo, cancelInteraction };
}
