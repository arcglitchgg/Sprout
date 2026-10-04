"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDiscord } from "@/hooks/useDiscord";
import { CloudSaveError, cloudSavePayloadBytes, fetchCloudSave, putCloudSave } from "@/lib/cloud-save-client";
import { cloudRetryDelay, timedOutSaveCommitted } from "@/lib/cloud-save-retry";
import { logCloudSaveDiagnostic } from "@/lib/cloud-save-diagnostics";
import { discordSaveKey, loadSproutSave, readSaveAcknowledgement, writeSaveAcknowledgement, writeSproutSave } from "@/lib/save-storage";
import { canRetryLocalAfterConflict, chooseStartupSave, revisionForWrite, revisionFromSnapshot, UNKNOWN_CLOUD_REVISION } from "@/lib/save-reconciliation";
import type { CloudRevisionState } from "@/lib/save-reconciliation";
import type { SproutSavePayloadV3, SproutSaveV3 } from "@/lib/save-types";
import { SessionDisconnectedError } from "@/lib/session-client";

const LOCAL_DELAY_MS = 400;
const CLOUD_DELAY_MS = 4000;
const LEGACY_OWNER_KEY = "sprout.save.legacy-owner";
export type SaveStatus = "saved" | "saving" | "local-only" | "cloud-failed" | "conflict" | "local-failed";
export type SyncState = SaveStatus;

export function useSproutPersistence() {
  const discord = useDiscord();
  const [hydration, setHydration] = useState<{ complete: boolean; save: SproutSaveV3 | null }>({ complete: false, save: null });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("local-only");
  const canWrite = useRef(false);
  const latest = useRef<SproutSaveV3 | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudRevision = useRef<CloudRevisionState>(UNKNOWN_CLOUD_REVISION);
  const cloudSession = useRef<string | null>(null);
  const localKey = useRef("sprout.save");
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const conflictPaused = useRef(false);
  const retryPaused = useRef(false);
  const retryCount = useRef(0);
  const attemptSequence = useRef(0);
  const localFailed = useRef(false);
  const hydratedUser = useRef<string | null>(null);
  const unknownWithoutLocal = useRef(false);
  const flushCloudRef = useRef<() => Promise<void>>(async () => {});

  const showStatus = useCallback((status: SaveStatus) => setSaveStatus(localFailed.current ? "local-failed" : status), []);
  const loadLocal = useCallback((key?: string) => {
    try { return loadSproutSave(undefined, key); }
    catch { localFailed.current = true; setSaveStatus("local-failed"); return { status: "invalid" as const, save: null }; }
  }, []);
  const acknowledge = useCallback((save: SproutSaveV3, revision: number) => {
    if (!writeSaveAcknowledgement(window.localStorage, localKey.current, revision, save.savedAt)) {
      localFailed.current = true;
      setSaveStatus("local-failed");
    }
  }, []);

  const flushLocal = useCallback(() => {
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = null;
    if (!canWrite.current || !latest.current) return;
    if (writeSproutSave(latest.current, undefined, localKey.current)) {
      localFailed.current = false;
    } else {
      localFailed.current = true;
      setSaveStatus("local-failed");
    }
  }, []);

  const flushCloud = useCallback(async () => {
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    cloudTimer.current = null;
    if (!cloudSession.current || !dirty.current || inFlight.current || retryPaused.current || !latest.current) return;
    inFlight.current = true;
    const sending = latest.current;
    const attemptId = ++attemptSequence.current;
    const startedAt = performance.now();
    const startingRevision = cloudRevision.current;
    const diagnosticRevision = startingRevision.kind === "known" ? startingRevision.revision : null;
    let payloadBytes = cloudSavePayloadBytes(sending, diagnosticRevision);
    let failure: CloudSaveError | null = null;
    let retryDelay: number | null = null;
    let reconciliation: "committed" | "still-dirty" | "conflict" | "failed" | undefined;
    showStatus("saving");
    try {
      if (cloudRevision.current.kind === "unknown") {
        const remote = await fetchCloudSave(cloudSession.current);
        cloudRevision.current = revisionFromSnapshot(remote.revision);
        const acknowledgement = readSaveAcknowledgement(window.localStorage, localKey.current);
        if (unknownWithoutLocal.current && remote.save) {
          dirty.current = true;
          conflictPaused.current = true;
          showStatus("conflict");
          return;
        }
        unknownWithoutLocal.current = false;
        const decision = chooseStartupSave(sending, remote.save, acknowledgement);
        if (decision === "cloud" || decision === "local-conflict") {
          const identical = decision === "cloud" && remote.save !== null && JSON.stringify(sending) === JSON.stringify(remote.save);
          dirty.current = !identical;
          conflictPaused.current = !identical;
          if (identical && remote.revision !== null) acknowledge(remote.save!, remote.revision);
          showStatus(identical ? "saved" : "conflict");
          return;
        }
      }

      const expectedRevision = revisionForWrite(cloudRevision.current);
      if (expectedRevision === undefined) throw new Error("Cloud revision is unknown.");
      payloadBytes = cloudSavePayloadBytes(sending, expectedRevision);
      logCloudSaveDiagnostic("start", {
        attemptId, payloadBytes, revisionState: cloudRevision.current.kind,
        revision: typeof expectedRevision === "number" ? expectedRevision : null,
        durationMs: 0, retryCount: retryCount.current,
      });
      dirty.current = false;
      const result = await putCloudSave(cloudSession.current, sending, expectedRevision);
      if (result !== "conflict") {
        cloudRevision.current = { kind: "known", revision: result };
        conflictPaused.current = false;
        retryPaused.current = false;
        retryCount.current = 0;
        acknowledge(sending, result);
        showStatus(dirty.current || latest.current !== sending ? "saving" : "saved");
        return;
      }

      dirty.current = true;
      const remote = await fetchCloudSave(cloudSession.current);
      cloudRevision.current = revisionFromSnapshot(remote.revision);
      const retrying = latest.current;
      if (!canRetryLocalAfterConflict(retrying, remote.save)) {
        conflictPaused.current = true;
        showStatus("conflict");
        return;
      }
      const retryRevision = revisionForWrite(cloudRevision.current);
      if (retryRevision === undefined) { conflictPaused.current = true; showStatus("conflict"); return; }
      const retry = await putCloudSave(cloudSession.current, retrying, retryRevision);
      if (retry === "conflict") {
        dirty.current = true;
        conflictPaused.current = true;
        showStatus("conflict");
        return;
      }
      cloudRevision.current = { kind: "known", revision: retry };
      conflictPaused.current = false;
      retryPaused.current = false;
      retryCount.current = 0;
      acknowledge(retrying, retry);
      dirty.current = latest.current !== retrying;
      showStatus(dirty.current ? "saving" : "saved");
    } catch (error) {
      dirty.current = true;
      conflictPaused.current = false;
      if (error instanceof SessionDisconnectedError) {
        cloudSession.current = null;
        retryPaused.current = true;
      } else {
        failure = error instanceof CloudSaveError ? error : new CloudSaveError("unknown");
        if (failure.kind === "timeout" && cloudSession.current) {
          try {
            const remote = await fetchCloudSave(cloudSession.current);
            cloudRevision.current = revisionFromSnapshot(remote.revision);
            if (timedOutSaveCommitted(sending, remote) && remote.revision !== null) {
              acknowledge(sending, remote.revision);
              dirty.current = latest.current !== sending;
              retryPaused.current = false;
              retryCount.current = 0;
              reconciliation = "committed";
              showStatus(dirty.current ? "saving" : "saved");
              return;
            }
            const retrying = latest.current;
            if (retrying && canRetryLocalAfterConflict(retrying, remote.save)) {
              reconciliation = "still-dirty";
              retryDelay = cloudRetryDelay("timeout", retryCount.current++);
              retryPaused.current = false;
            } else {
              reconciliation = "conflict";
              conflictPaused.current = true;
              retryPaused.current = false;
              showStatus("conflict");
              return;
            }
          } catch (reconciliationError) {
            reconciliation = "failed";
            cloudRevision.current = UNKNOWN_CLOUD_REVISION;
            if (reconciliationError instanceof SessionDisconnectedError) {
              cloudSession.current = null;
              retryPaused.current = true;
            } else {
              retryDelay = cloudRetryDelay("timeout", retryCount.current++);
            }
          }
        } else {
          retryDelay = cloudRetryDelay(failure.kind, retryCount.current++);
          retryPaused.current = retryDelay === null;
        }
      }
      showStatus("cloud-failed");
    } finally {
      inFlight.current = false;
      const durationMs = Math.round(performance.now() - startedAt);
      logCloudSaveDiagnostic("result", {
        attemptId, payloadBytes, revisionState: cloudRevision.current.kind,
        revision: cloudRevision.current.kind === "known" ? cloudRevision.current.revision : null,
        httpStatus: failure?.status, errorType: failure?.kind, durationMs, retryCount: retryCount.current,
        ...(retryDelay === null ? {} : { backoffMs: retryDelay }), ...(reconciliation ? { reconciliation } : {}),
      });
      const nextDelay = retryDelay ?? (!failure && dirty.current ? CLOUD_DELAY_MS : null);
      if (nextDelay !== null && dirty.current && !conflictPaused.current && !retryPaused.current && cloudSession.current) cloudTimer.current = setTimeout(() => { void flushCloudRef.current(); }, nextDelay);
    }
  }, [acknowledge, showStatus]);

  useEffect(() => { flushCloudRef.current = flushCloud; }, [flushCloud]);

  useEffect(() => {
    if (!discord.resolved) return;
    let cancelled = false;
    const hydrate = async () => {
      canWrite.current = true;
      if (discord.environment === "standalone") {
        const local = loadLocal();
        canWrite.current = local.status !== "future";
        setHydration({ complete: true, save: local.status === "loaded" ? local.save : null });
        setSaveStatus("local-only");
        return;
      }
      if (!discord.user) {
        const local = loadLocal();
        setHydration({ complete: true, save: local.status === "loaded" ? local.save : null });
        setSaveStatus("cloud-failed");
        return;
      }
      const userId = discord.user.id;
      cloudSession.current = discord.session;
      if (hydratedUser.current === userId) return;
      hydratedUser.current = userId;
      localKey.current = discordSaveKey(userId);
      const owned = loadLocal(localKey.current);
      if (owned.status === "future") localKey.current += ".v3-cache";
      let owner: string | null = null;
      try { owner = window.localStorage.getItem(LEGACY_OWNER_KEY); if (!owner) window.localStorage.setItem(LEGACY_OWNER_KEY, userId); }
      catch { localFailed.current = true; setSaveStatus("local-failed"); }
      const legacy = !owner || owner === userId ? loadLocal() : { status: "empty" as const, save: null };
      const local = owned.status === "loaded" || owned.status === "future" ? owned : legacy;
      const localSave = local.status === "loaded" ? local.save : null;
      if (!discord.session) {
        cloudRevision.current = UNKNOWN_CLOUD_REVISION;
        setHydration({ complete: true, save: localSave });
        setSaveStatus("cloud-failed");
        return;
      }
      showStatus("saving");
      try {
        const remote = await fetchCloudSave(discord.session);
        if (cancelled) return;
        cloudRevision.current = revisionFromSnapshot(remote.revision);
        unknownWithoutLocal.current = false;
        const acknowledgement = readSaveAcknowledgement(window.localStorage, localKey.current);
        const decision = chooseStartupSave(localSave, remote.save, acknowledgement);
        if (decision === "cloud") {
          writeSproutSave(remote.save!, undefined, localKey.current);
          if (remote.revision !== null) acknowledge(remote.save!, remote.revision);
          latest.current = remote.save;
          dirty.current = false;
          setHydration({ complete: true, save: remote.save });
          showStatus("saved");
        } else if (decision === "local-upload") {
          latest.current = localSave;
          dirty.current = Boolean(localSave);
          conflictPaused.current = false;
          retryPaused.current = false;
          retryCount.current = 0;
          setHydration({ complete: true, save: localSave });
          showStatus("saving");
          if (localSave) cloudTimer.current = setTimeout(() => { void flushCloudRef.current(); }, 0);
        } else if (decision === "local-conflict") {
          latest.current = localSave;
          dirty.current = Boolean(localSave);
          conflictPaused.current = true;
          setHydration({ complete: true, save: localSave });
          showStatus("conflict");
        } else {
          setHydration({ complete: true, save: null });
          showStatus("saved");
        }
      } catch {
        if (cancelled) return;
        cloudRevision.current = UNKNOWN_CLOUD_REVISION;
        unknownWithoutLocal.current = !localSave;
        latest.current = localSave;
        dirty.current = Boolean(localSave);
        setHydration({ complete: true, save: localSave });
        showStatus("cloud-failed");
        if (localSave) cloudTimer.current = setTimeout(() => { void flushCloudRef.current(); }, CLOUD_DELAY_MS);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [acknowledge, discord.environment, discord.resolved, discord.session, discord.user, loadLocal, showStatus]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "hidden") { flushLocal(); void flushCloud(); } };
    const onPageHide = () => { flushLocal(); void flushCloud(); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("pagehide", onPageHide); document.removeEventListener("visibilitychange", onVisibility); if (localTimer.current) clearTimeout(localTimer.current); if (cloudTimer.current) clearTimeout(cloudTimer.current); };
  }, [flushLocal, flushCloud]);

  const scheduleSave = useCallback((payload: SproutSavePayloadV3) => {
    if (!canWrite.current) return;
    if (latest.current && JSON.stringify({ game: latest.current.game, world: latest.current.world }) === JSON.stringify(payload)) return;
    latest.current = { version: 3, savedAt: Date.now(), ...payload };
    dirty.current = true;
    conflictPaused.current = false;
    retryPaused.current = false;
    retryCount.current = 0;
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(flushLocal, LOCAL_DELAY_MS);
    if (cloudSession.current) {
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
      cloudTimer.current = setTimeout(() => { void flushCloud(); }, CLOUD_DELAY_MS);
      if (saveStatus === "saved") showStatus("saving");
    } else showStatus(discord.environment === "standalone" ? "local-only" : "cloud-failed");
  }, [discord.environment, flushLocal, flushCloud, saveStatus, showStatus]);

  return { hydration, scheduleSave, syncState: saveStatus, saveStatus };
}
