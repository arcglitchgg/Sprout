"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadSproutSave, writeSproutSave } from "@/lib/save-storage";
import type { SproutSavePayloadV1, SproutSaveV1 } from "@/lib/save-types";

const AUTOSAVE_DELAY_MS = 400;

export function useSproutPersistence() {
  const [hydration, setHydration] = useState<{ complete: boolean; save: SproutSaveV1 | null }>({ complete: false, save: null });
  const canWrite = useRef(false);
  const latest = useRef<SproutSaveV1 | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (canWrite.current && latest.current) writeSproutSave(latest.current);
  }, []);

  useEffect(() => {
    const result = loadSproutSave();
    canWrite.current = result.status !== "future";
    const hydrationTask = setTimeout(() => {
      setHydration({ complete: true, save: result.status === "loaded" ? result.save : null });
    }, 0);
    return () => clearTimeout(hydrationTask);
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const scheduleSave = useCallback((payload: SproutSavePayloadV1) => {
    if (!canWrite.current) return;
    latest.current = { version: 1, savedAt: Date.now(), ...payload };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }, [flush]);

  return { hydration, scheduleSave };
}
