"use client";

import { useEffect, useRef, useState } from "react";
import WorldMap from "@/components/WorldMap";
import WorldSeedShopPanel from "@/components/WorldSeedShopPanel";
import WorldDungeonOverlay from "@/components/WorldDungeonOverlay";
import WorldFarmhouseOverlay from "@/components/WorldFarmhouseOverlay";
import WorldMarketOverlay from "@/components/WorldMarketOverlay";
import WorldFriendsOverlay from "@/components/WorldFriendsOverlay";
import WorldNotifications from "@/components/WorldNotifications";
import RemotePlayersLayer from "@/components/RemotePlayersLayer";
import WorldPvpOverlay from "@/components/WorldPvpOverlay";
import type { WorldNotification } from "@/components/WorldNotifications";
import { useWorldMovement } from "@/hooks/useWorldMovement";
import { useDiscord } from "@/hooks/useDiscord";
import { FARM_OWNER_TILE, FIRST_WORLD } from "@/lib/world-data";
import { findPath, findPathToAdjacent } from "@/lib/pathfinding";
import { canModifyFarm } from "@/lib/social";
import type { FriendFarmSnapshot, WorldContext, WorldPlayer } from "@/lib/social-types";
import { useFarmPresence } from "@/hooks/useFarmPresence";
import { playerInRange, playerName } from "@/lib/challenges";
import { socialRequest } from "@/lib/social-client";
import { cellToWorld, worldToCell } from "@/lib/world-coordinates";
import { getFollowCamera, getOverviewCamera, screenToCanonicalWorld } from "@/lib/world-camera";
import type { CameraMode } from "@/lib/world-camera";
import { getPlotUnlockLevel } from "@/lib/progression";
import { crops } from "@/lib/game-data";
import { getSecondsRemaining, isReady } from "@/lib/farming";
import type { CollectionEntry, CropType, Fighter, HarvestedCrop, Plot, SeedInventory } from "@/lib/game-types";
import type { BattleState } from "@/lib/battle-types";
import type { WorldBuildingId } from "@/lib/world-types";
import type { WorldPoint } from "@/lib/world-types";

const WORLD_PIXEL_WIDTH = FIRST_WORLD.pixelWidth;
const WORLD_PIXEL_HEIGHT = FIRST_WORLD.pixelHeight;

type Props = {
  coins: number;
  unlockedPlotCount: number;
  plots: Plot[];
  now: number;
  selectedCrop: CropType;
  setSelectedCrop: (crop: CropType) => void;
  seeds: SeedInventory;
  buySeed: (crop: CropType) => void;
  handlePlotClick: (plot: Plot, clickedAt: number) => string | null;
  harvestAll: (clickedAt: number) => number;
  fighters: Fighter[];
  collection: CollectionEntry[];
  harvestedCrops: HarvestedCrop[];
  sellCrops: (itemIds: string[]) => void;
  awakenCrop: (itemId: string) => void;
  fuseFighters: (selectedIds: string[]) => Fighter | null;
  awardBattleVictory: (result: BattleState) => void;
  notifications: WorldNotification[];
  notify: (notification: Omit<WorldNotification, "id">) => void;
  onDismissNotification: (id: string) => void;
  initialFarmerTile?: WorldPoint;
  initialFarmerFacing?: "left" | "right";
  onFarmerSettled: (tile: WorldPoint, facing: "left" | "right") => void;
};

export default function PixelWorld(props: Props) {
  const [context, setContext] = useState<WorldContext>({ mode: "own-farm" });
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  // Only the presentation scene remounts. SproutGame/useGame and its own position remain intact.
  return <PixelWorldScene key={context.mode === "visiting" ? `visit:${context.ownerId}` : "own"} {...props} context={context} cameraMode={cameraMode} setCameraMode={setCameraMode}
    onVisit={(snapshot) => setContext({ mode: "visiting", ownerId: snapshot.owner.userId, snapshot })}
    onReturnHome={() => setContext({ mode: "own-farm" })} />;
}

function PixelWorldScene({ coins, unlockedPlotCount: ownUnlockedPlotCount, plots: ownPlots, now, selectedCrop, setSelectedCrop, seeds, buySeed, handlePlotClick, harvestAll, fighters, collection, harvestedCrops, sellCrops, awakenCrop, fuseFighters, awardBattleVictory, notifications, notify, onDismissNotification, initialFarmerTile, initialFarmerFacing, onFarmerSettled, context, onVisit, onReturnHome, cameraMode, setCameraMode }: Props & {
  context: WorldContext; onVisit: (snapshot: FriendFarmSnapshot) => void; onReturnHome: () => void; cameraMode: CameraMode; setCameraMode: (mode: CameraMode) => void;
}) {
  const visiting = !canModifyFarm(context);
  const plots = context.mode === "visiting" ? context.snapshot.plots : ownPlots;
  const unlockedPlotCount = context.mode === "visiting" ? context.snapshot.unlockedPlotCount : ownUnlockedPlotCount;
  const { user, session } = useDiscord();
  const { ownerOnline, presentIds, reconnectingIds, remoteStore, updateLocalMovement, challenge, challengeMessage, requestChallenge, respondChallenge, dismissChallenge } = useFarmPresence(session, user?.id ?? null, context.mode === "visiting" ? context.ownerId : user?.id ?? null);
  const [remoteProfiles, setRemoteProfiles] = useState<Record<string, { displayName: string | null; username: string }>>({});
  const [challengeTarget, setChallengeTarget] = useState<{ userId: string; displayName: string } | null>(null);
  const roomIds = presentIds.filter((id) => id !== user?.id).join(",");
  const presentIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { presentIdsRef.current = new Set(presentIds); }, [presentIds]);
  useEffect(() => {
    if (!session || !roomIds) return;
    const controller = new AbortController();
    socialRequest<{ players: { userId: string; displayName: string | null; username: string }[] }>(session, `/api/players/profiles?ids=${roomIds}`, "GET", undefined, controller.signal)
      .then(({ players }) => { if (!controller.signal.aborted) setRemoteProfiles(Object.fromEntries(players.map((profile) => [profile.userId, profile]))); })
      .catch(() => {});
    return () => controller.abort();
  }, [session, roomIds]);
  const visitorCount = !visiting && user ? presentIds.filter((id) => id !== user.id).length : 0;
  const { state, moveTo, cancelInteraction } = useWorldMovement(FIRST_WORLD, { initialTile: visiting ? FIRST_WORLD.start : initialFarmerTile, initialFacing: visiting ? "right" : initialFarmerFacing, onSettled: visiting ? undefined : onFarmerSettled });
  const viewportRef = useRef<HTMLDivElement>(null);
  const plotsRef = useRef(plots);
  const handlePlotClickRef = useRef(handlePlotClick);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const lastSeedWarning = useRef(0);
  const [growingPlotId, setGrowingPlotId] = useState<number | null>(null);
  const [seedShopOpen, setSeedShopOpen] = useState(false);
  const [dungeonOpen, setDungeonOpen] = useState(false);
  const [farmhouseOpen, setFarmhouseOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [ownerPrompt, setOwnerPrompt] = useState<string | null>(null);
  const modalOpen = farmhouseOpen || marketOpen || friendsOpen || dungeonOpen || seedShopOpen || ownerPrompt !== null || challengeTarget !== null || challenge !== null;
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const toggle = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === "KeyG") {
        event.preventDefault();
        setDebug((value) => !value);
      }
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  useEffect(() => {
    plotsRef.current = plots;
    handlePlotClickRef.current = handlePlotClick;
  }, [plots, handlePlotClick]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewportSize({ width, height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  function closeInteraction() {
    cancelInteraction();
    setGrowingPlotId(null);
    setSeedShopOpen(false);
    setFarmhouseOpen(false);
    setMarketOpen(false);
    setFriendsOpen(false);
    setOwnerPrompt(null);
    setChallengeTarget(null);
  }

  function arriveAtPlot(plotId: number) {
    const plot = plotsRef.current.find((entry) => entry.id === plotId);
    if (!plot) return;
    if (visiting) {
      if (plot.crop) setGrowingPlotId(plotId);
      else notify({ kind: "info", title: "This is your friend's farm. Plots are view-only." });
      return;
    }
    const arrivedAt = Date.now();
    if (!plot.crop) {
      const message = handlePlotClickRef.current(plot, arrivedAt);
      if (message && arrivedAt - lastSeedWarning.current > 2000) {
        lastSeedWarning.current = arrivedAt;
        notify({ kind: "error", title: message });
      }
      return;
    }
    if (isReady(plot, arrivedAt)) {
      handlePlotClickRef.current(plot, arrivedAt);
      return;
    }
    setGrowingPlotId(plotId);
  }

  function selectPlot(plotId: number) {
    if (modalOpen) return;
    closeInteraction();
    const worldPlot = FIRST_WORLD.farmPlots.find((plot) => plot.id === plotId);
    if (!worldPlot) return;
    if (plotId >= unlockedPlotCount) {
      notify({ kind: "info", title: `Unlocks at Farm Level ${getPlotUnlockLevel(plotId)}` });
      return;
    }
    const destination = worldToCell(FIRST_WORLD, worldPlot.approach);
    const route = findPath(FIRST_WORLD.blocked, FIRST_WORLD.width, FIRST_WORLD.height, state.tile, destination);
    if (!route.length) {
      notify({ kind: "error", title: "That plot cannot be reached." });
      return;
    }
    moveTo(destination, () => arriveAtPlot(plotId));
  }

  function moveInWorld(destination: { x: number; y: number }) {
    if (modalOpen) return;
    closeInteraction();
    moveTo(destination);
  }

  function selectBuilding(buildingId: WorldBuildingId) {
    if (modalOpen) return;
    closeInteraction();
    const building = FIRST_WORLD.buildings.find((entry) => entry.id === buildingId);
    if (!building || (visiting && buildingId !== "world-exit") || (buildingId !== "seed-shop" && buildingId !== "dungeon" && buildingId !== "farmhouse" && buildingId !== "market" && buildingId !== "world-exit")) return;
    const entrance = worldToCell(FIRST_WORLD, building.entrance);
    const path = findPath(FIRST_WORLD.blocked, FIRST_WORLD.width, FIRST_WORLD.height, state.tile, entrance);
    if (!path.length) {
      notify({ kind: "error", title: `${building.label} cannot be reached.` });
      return;
    }
    moveTo(entrance, () => {
      if (buildingId === "seed-shop") setSeedShopOpen(true);
      if (buildingId === "dungeon") setDungeonOpen(true);
      if (buildingId === "farmhouse") setFarmhouseOpen(true);
      if (buildingId === "market") setMarketOpen(true);
      if (buildingId === "world-exit") setFriendsOpen(true);
    });
  }

  const growingPlot = growingPlotId === null ? null : plots.find((plot) => plot.id === growingPlotId);
  const readyCount = visiting ? 0 : plots.filter((plot) => plot.id < unlockedPlotCount && isReady(plot, now)).length;
  const farmerWorldPosition = cellToWorld(FIRST_WORLD, state.position);
  const ownerPosition = cellToWorld(FIRST_WORLD, FARM_OWNER_TILE);
  useEffect(() => {
    updateLocalMovement({ ...cellToWorld(FIRST_WORLD, state.position), facing: state.facing, moving: state.moving });
  }, [state.position, state.facing, state.moving, updateLocalMovement]);
  const players: WorldPlayer[] = [{
    userId: user?.id ?? "local", displayName: user?.globalName ?? user?.username ?? "Farmer", ...farmerWorldPosition,
    facing: state.facing, isOwner: !visiting, isLocal: true, online: true, moving: state.moving, frame: state.frame,
  }];

  function selectPlayer(player: WorldPlayer) {
    if (modalOpen || player.isLocal) return;
    if (player.online && presentIds.includes(player.userId)) {
      closeInteraction();
      const targetId = player.userId;
      const target = remoteStore.getSnapshot().find((entry) => entry.userId === targetId);
      const targetPosition = target ? { x: target.currentX, y: target.currentY } : player;
      const route = findPathToAdjacent(FIRST_WORLD.blocked, FIRST_WORLD.width, FIRST_WORLD.height, state.tile, worldToCell(FIRST_WORLD, targetPosition));
      if (!route) { notify({ kind: "error", title: "That player cannot be reached." }); return; }
      moveTo(route.destination, () => {
        const current = remoteStore.getSnapshot().find((entry) => entry.userId === targetId);
        const currentPosition = current ? { x: current.currentX, y: current.currentY } : player;
        if (!presentIdsRef.current.has(targetId) || !playerInRange(cellToWorld(FIRST_WORLD, route.destination), currentPosition)) {
          notify({ kind: "info", title: "That player moved away." }); return;
        }
        setChallengeTarget({ userId: targetId, displayName: playerName(targetId, remoteProfiles, context.mode === "visiting" ? context.snapshot.owner : null) });
      });
      return;
    }
    if (!visiting || !player.isOwner) return;
    closeInteraction();
    const route = findPathToAdjacent(FIRST_WORLD.blocked, FIRST_WORLD.width, FIRST_WORLD.height, state.tile, worldToCell(FIRST_WORLD, player));
    if (!route) { notify({ kind: "error", title: "The farm owner cannot be reached." }); return; }
    moveTo(route.destination, () => setOwnerPrompt(player.displayName));
  }
  const camera = cameraMode === "follow"
    ? getFollowCamera(WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT, viewportSize, farmerWorldPosition)
    : getOverviewCamera(WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT, viewportSize);

  function screenToWorld(point: WorldPoint) {
    const viewport = viewportRef.current;
    if (!viewport) return point;
    const bounds = viewport.getBoundingClientRect();
    return screenToCanonicalWorld(camera, { x: bounds.left + viewport.clientLeft, y: bounds.top + viewport.clientTop }, point);
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2 px-1 text-[#e8eadf]">
        <div>
          <h2 className="max-w-64 truncate text-base font-bold sm:text-lg">{context.mode === "visiting" ? `${context.snapshot.owner.displayName ?? context.snapshot.owner.username}'s farm · Lv ${context.snapshot.owner.farmLevel}` : "Sprout Valley"}</h2>
          <p className="hidden text-xs text-[#b9c1b9] sm:block">{visiting ? "Visiting · View-only. Walk around or talk to the farm owner." : "Click or tap to walk. Visit the shops, plots, Dungeon, or Friends exit."}</p>
          {visitorCount > 0 && <p className="text-xs text-lime-300">{visitorCount} visitor{visitorCount === 1 ? "" : "s"} online</p>}
        </div>
        {visiting && <button type="button" onClick={onReturnHome} className="rounded-lg bg-[#ffe28a] px-3 py-2 text-xs font-bold text-[#4a2c12]">Return Home</button>}
        <div className="flex rounded-lg border border-white/15 bg-[#252d27] p-0.5" aria-label="Camera mode">
          {(["overview", "follow"] as CameraMode[]).map((mode) => (
            <button key={mode} type="button" onClick={() => setCameraMode(mode)} aria-pressed={cameraMode === mode} className={`rounded-md px-2 py-1 text-xs font-bold capitalize ${cameraMode === mode ? "bg-[#ffe28a] text-[#4a2c12]" : "text-[#e8eadf] hover:bg-white/10"}`}>
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div ref={viewportRef} className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#101512]">
        <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: WORLD_PIXEL_WIDTH, height: WORLD_PIXEL_HEIGHT, transform: `matrix(${camera.scale}, 0, 0, ${camera.scale}, ${camera.x}, ${camera.y})`, imageRendering: "pixelated" }}>
          <WorldMap world={FIRST_WORLD} players={players} moveTo={moveInWorld} plots={plots} unlockedPlotCount={unlockedPlotCount} now={now} onPlotClick={selectPlot} onBuildingClick={selectBuilding} onPlayerClick={selectPlayer} screenToWorld={screenToWorld} readOnly={visiting} labelScale={Math.max(1, 0.8 / camera.scale)} debug={debug} />
          <RemotePlayersLayer store={remoteStore} localId={user?.id ?? null} ownerId={context.mode === "visiting" ? context.ownerId : null} ownerName={context.mode === "visiting" ? context.snapshot.owner.displayName ?? context.snapshot.owner.username : null} ownerFallback={ownerPosition} ownerOnline={ownerOnline} reconnectingIds={reconnectingIds} profiles={remoteProfiles} labelScale={Math.max(1, 0.8 / camera.scale)} onInteract={selectPlayer} />
        </div>
        <WorldNotifications notifications={notifications} onDismiss={onDismissNotification} />
        {!visiting && <div className="absolute bottom-2 left-2 right-2 z-40 flex flex-wrap items-end justify-between gap-2 pointer-events-none" aria-label="Farm quick actions">
          <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[#765438] bg-[#fff8dc]/95 p-1 text-[#2f3e2f] shadow-lg" aria-label="Selected planting crop">
            {(Object.keys(crops) as CropType[]).map((cropKey) => <button key={cropKey} type="button" onClick={() => setSelectedCrop(cropKey)} aria-pressed={selectedCrop === cropKey} className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${selectedCrop === cropKey ? "bg-[#4f772d] text-white" : "bg-white/70"}`}>
              {crops[cropKey].name} · {seeds[cropKey]}
            </button>)}
          </div>
          <button type="button" disabled={readyCount === 0} onClick={() => harvestAll(Date.now())} className="pointer-events-auto rounded-lg bg-[#ffe28a] px-3 py-2 text-xs font-black text-[#4a2c12] shadow-lg disabled:cursor-not-allowed disabled:opacity-50">Harvest All {readyCount > 0 ? `(${readyCount})` : ""}</button>
        </div>}
      </div>

      {growingPlot?.crop && (
        <div className="absolute bottom-5 left-1/2 z-50 flex w-[min(92%,360px)] -translate-x-1/2 items-center justify-between rounded-xl border-2 border-[#765438] bg-[#fff8dc] p-3 text-sm text-[#2f3e2f] shadow-xl">
          <span><strong>{crops[growingPlot.crop].name}</strong> · {isReady(growingPlot, now) ? visiting ? "Ready · View-only" : "Ready — click the plot again" : `${getSecondsRemaining(growingPlot, now)}s remaining`}</span>
          <button type="button" onClick={closeInteraction} className="rounded px-2 font-bold" aria-label="Close crop status">×</button>
        </div>
      )}

      {!visiting && seedShopOpen && <WorldSeedShopPanel coins={coins} seeds={seeds} buySeed={buySeed} onClose={() => setSeedShopOpen(false)} />}
      {!visiting && dungeonOpen && <WorldDungeonOverlay fighters={fighters} onVictory={awardBattleVictory} onClose={() => setDungeonOpen(false)} />}
      {!visiting && farmhouseOpen && <WorldFarmhouseOverlay collection={collection} fighters={fighters} harvestedCrops={harvestedCrops} awakenCrop={awakenCrop} fuseFighters={fuseFighters} onClose={() => setFarmhouseOpen(false)} />}
      {!visiting && marketOpen && <WorldMarketOverlay coins={coins} harvestedCrops={harvestedCrops} sellCrops={sellCrops} onClose={() => setMarketOpen(false)} />}
      {friendsOpen && <WorldFriendsOverlay fighters={fighters} onVisit={onVisit} onClose={() => setFriendsOpen(false)} presenceOwnerId={context.mode === "visiting" ? context.ownerId : user?.id ?? null} presenceRole={visiting ? "visitor" : "owner"} presenceMemberCount={presentIds.length} />}
      {ownerPrompt !== null && <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Challenge farm owner"><div className="w-full max-w-sm rounded-xl bg-[#fff8dc] p-5 text-[#2f3e2f]"><h3 className="break-words text-lg font-bold">Challenge {ownerPrompt}?</h3><p className="my-3 text-sm">Farm battles are coming next.</p><div className="flex gap-2"><button type="button" disabled className="rounded-lg bg-[#4f772d] px-3 py-2 text-white opacity-40">Battle · Coming next</button><button type="button" onClick={() => setOwnerPrompt(null)} className="rounded-lg border border-[#765438] px-3 py-2 font-bold">Cancel</button></div></div></div>}
      {challenge?.status === "accepted" && session && user && <WorldPvpOverlay session={session} localId={user.id} opponentId={challenge.role === "outgoing" ? challenge.packet.toUserId : challenge.packet.fromUserId} opponentName={playerName(challenge.role === "outgoing" ? challenge.packet.toUserId : challenge.packet.fromUserId, remoteProfiles, context.mode === "visiting" ? context.snapshot.owner : null)} challengeId={challenge.packet.challengeId} presentIds={presentIds} fighters={fighters} onClose={dismissChallenge} />}
      {(challengeTarget || challenge?.status === "pending" || (challengeMessage && !challenge)) && <div className="absolute inset-0 z-[76] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Player challenge"><div className="w-full max-w-sm rounded-xl border-2 border-[#765438] bg-[#fff8dc] p-4 text-[#2f3e2f] shadow-xl">
        <h3 className="text-lg font-bold">{challenge?.status === "accepted" ? "Challenge accepted — Battle coming next" : challenge?.role === "incoming" ? `${playerName(challenge.packet.fromUserId, remoteProfiles, context.mode === "visiting" ? context.snapshot.owner : null)} challenged you!` : challenge?.role === "outgoing" ? `Waiting for ${playerName(challenge.packet.toUserId, remoteProfiles, context.mode === "visiting" ? context.snapshot.owner : null)}...` : challengeTarget ? `Challenge ${challengeTarget.displayName}?` : challengeMessage}</h3>
        {challengeMessage && challenge && <p className="mt-2 text-sm">{challengeMessage}</p>}
        <div className="mt-4 flex gap-2">
          {challengeTarget && !challenge && <button type="button" className="rounded-lg bg-[#4f772d] px-3 py-2 font-bold text-white" onClick={() => { void requestChallenge(challengeTarget.userId).then((sent) => { if (!sent) notify({ kind: "error", title: "Player is unavailable or busy." }); }); setChallengeTarget(null); }}>Challenge</button>}
          {challenge?.role === "incoming" && challenge.status === "pending" && <><button type="button" className="rounded-lg bg-[#4f772d] px-3 py-2 font-bold text-white" onClick={() => void respondChallenge(true)}>Accept</button><button type="button" className="rounded-lg border border-[#765438] px-3 py-2 font-bold" onClick={() => void respondChallenge(false)}>Decline</button></>}
          {(challenge?.role !== "incoming" || challenge.status === "accepted") && <button type="button" className="rounded-lg border border-[#765438] px-3 py-2 font-bold" onClick={() => { setChallengeTarget(null); dismissChallenge(); }}>{challenge?.role === "outgoing" && challenge.status === "pending" ? "Cancel challenge" : "Close"}</button>}
        </div>
      </div></div>}
    </section>
  );
}
