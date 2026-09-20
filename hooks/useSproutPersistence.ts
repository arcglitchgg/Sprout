"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDiscord } from "@/hooks/useDiscord";
import { fetchCloudSave, putCloudSave } from "@/lib/cloud-save-client";
import { discordSaveKey, loadSproutSave, writeSproutSave } from "@/lib/save-storage";
import type { SproutSavePayloadV2, SproutSaveV2 } from "@/lib/save-types";

const LOCAL_DELAY_MS = 400;
const CLOUD_DELAY_MS = 4000;
const LEGACY_OWNER_KEY = "sprout.save.legacy-owner";
export type SyncState = "local-only" | "loading-cloud" | "synced" | "saving" | "unsynced" | "conflict";

export function useSproutPersistence() {
  const discord = useDiscord();
  const [hydration, setHydration] = useState<{ complete: boolean; save: SproutSaveV2 | null }>({ complete: false, save: null });
  const [syncState, setSyncState] = useState<SyncState>("local-only");
  const canWrite = useRef(false);
  const latest = useRef<SproutSaveV2 | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudRevision = useRef<number | null>(null);
  const cloudSession = useRef<string | null>(null);
  const localKey = useRef("sprout.save");
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const flushCloudRef = useRef<() => Promise<void>>(async () => {});

  const flushLocal = useCallback(() => {
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = null;
    if (canWrite.current && latest.current) writeSproutSave(latest.current, undefined, localKey.current);
  }, []);

  const flushCloud = useCallback(async () => {
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    cloudTimer.current = null;
    if (!cloudSession.current || !dirty.current || blocked.current || inFlight.current || !latest.current) return;
    inFlight.current = true;
    dirty.current = false;
    const sending = latest.current;
    setSyncState("saving");
    try {
      const result = await putCloudSave(cloudSession.current, sending, cloudRevision.current);
      if (result === "conflict") {
        blocked.current = true;
        setSyncState("conflict");
        try { await fetchCloudSave(cloudSession.current); } catch { /* Keep local progress. */ }
      } else {
        cloudRevision.current = result;
        setSyncState(dirty.current ? "unsynced" : "synced");
      }
    } catch {
      dirty.current = true;
      setSyncState("unsynced");
    } finally {
      inFlight.current = false;
      if (dirty.current && !blocked.current && cloudSession.current) cloudTimer.current = setTimeout(() => { void flushCloudRef.current(); }, CLOUD_DELAY_MS);
    }
  }, []);

  useEffect(() => { flushCloudRef.current = flushCloud; }, [flushCloud]);

  useEffect(() => {
    if (!discord.resolved) return;
    let cancelled = false;
    const hydrate = async () => {
      if (discord.environment === "standalone") {
        const local = loadSproutSave();
        canWrite.current = local.status !== "future";
        setHydration({ complete: true, save: local.status === "loaded" ? local.save : null });
        setSyncState("local-only");
        return;
      }
      if (!discord.user) {
        canWrite.current = false;
        setHydration({ complete: true, save: null });
        setSyncState("local-only");
        return;
      }
      const userId = discord.user.id;
      localKey.current = discordSaveKey(userId);
      const owned = loadSproutSave(undefined, localKey.current);
      if (owned.status === "future") localKey.current += ".v2-cache";
      const owner = window.localStorage.getItem(LEGACY_OWNER_KEY);
      if (!owner) window.localStorage.setItem(LEGACY_OWNER_KEY, userId);
      const legacy = !owner || owner === userId ? loadSproutSave() : { status: "empty" as const, save: null };
      const local = owned.status === "loaded" || owned.status === "future" ? owned : legacy;
      canWrite.current = true;
      if (!discord.session) {
        setHydration({ complete: true, save: local.status === "loaded" ? local.save : null });
        setSyncState("local-only");
        return;
      }
      cloudSession.current = discord.session;
      setSyncState("loading-cloud");
      try {
        const remote = await fetchCloudSave(discord.session);
        if (cancelled) return;
        cloudRevision.current = remote.revision;
        if (remote.save) {
          writeSproutSave(remote.save, undefined, localKey.current);
          setHydration({ complete: true, save: remote.save });
          setSyncState("synced");
        } else if (local.status === "loaded") {
          const upload = await putCloudSave(discord.session, local.save, null);
          if (cancelled) return;
          if (upload === "conflict") {
            const winner = await fetchCloudSave(discord.session);
            if (cancelled) return;
            if (!winner.save) throw new Error("Cloud save conflict could not be resolved.");
            cloudRevision.current = winner.revision;
            writeSproutSave(winner.save, undefined, localKey.current);
            setHydration({ complete: true, save: winner.save });
          } else {
            cloudRevision.current = upload;
            writeSproutSave(local.save, undefined, localKey.current);
            setHydration({ complete: true, save: local.save });
          }
          setSyncState("synced");
        } else {
          setHydration({ complete: true, save: null });
          setSyncState("synced");
        }
      } catch {
        if (cancelled) return;
        setHydration({ complete: true, save: local.status === "loaded" ? local.save : null });
        setSyncState("unsynced");
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [discord.environment, discord.resolved, discord.session, discord.user]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "hidden") { flushLocal(); void flushCloud(); } };
    const onPageHide = () => { flushLocal(); void flushCloud(); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (localTimer.current) clearTimeout(localTimer.current);
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
    };
  }, [flushLocal, flushCloud]);

  const scheduleSave = useCallback((payload: SproutSavePayloadV2) => {
    if (!canWrite.current) return;
    latest.current = { version: 2, savedAt: Date.now(), ...payload };
    dirty.current = true;
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(flushLocal, LOCAL_DELAY_MS);
    if (cloudSession.current && !blocked.current) {
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
      cloudTimer.current = setTimeout(() => { void flushCloud(); }, CLOUD_DELAY_MS);
    }
  }, [flushLocal, flushCloud]);

  return { hydration, scheduleSave, syncState };
}
