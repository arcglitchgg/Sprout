export type SessionDisconnectReason = "session-expired" | "renewal-failed";

type SessionController = {
  session: string;
  renew: () => Promise<string | null>;
  onRenewed: (session: string) => void;
  onDisconnected: (reason: SessionDisconnectReason) => void;
};

let controller: SessionController | null = null;
let currentSession: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let disconnected = false;

export class SessionDisconnectedError extends Error {
  constructor() { super("Sprout session is disconnected."); }
}

function developmentLog(reason: "session-expired" | "renewal-failed" | "realtime-transport-disconnect") {
  if (process.env.NODE_ENV !== "production") console.info(`[Sprout session] ${reason}`);
}

export function logRealtimeTransportDisconnect() {
  developmentLog("realtime-transport-disconnect");
}

export function configureSessionController(next: SessionController) {
  controller = next;
  currentSession = next.session;
  disconnected = false;
  refreshPromise = null;
  return () => {
    if (controller === next) {
      controller = null;
      currentSession = null;
      refreshPromise = null;
      disconnected = false;
    }
  };
}

export function resetSessionControllerForTests() {
  controller = null;
  currentSession = null;
  refreshPromise = null;
  disconnected = false;
}

function disconnect(reason: SessionDisconnectReason) {
  if (disconnected) return;
  disconnected = true;
  currentSession = null;
  developmentLog(reason);
  controller?.onDisconnected(reason);
}

async function renewSession() {
  if (!controller || disconnected) return null;
  if (!refreshPromise) {
    refreshPromise = controller.renew().then((session) => {
      if (!session) return null;
      currentSession = session;
      controller?.onRenewed(session);
      return session;
    }).catch(() => null).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function authenticatedRequest(
  fallbackSession: string,
  request: (session: string) => Promise<Response>,
) {
  if (disconnected) throw new SessionDisconnectedError();
  const initialSession = currentSession ?? fallbackSession;
  const response = await request(initialSession);
  if (response.status !== 401) return response;

  developmentLog("session-expired");
  let replacement = currentSession !== initialSession ? currentSession : await renewSession();
  if (!replacement) {
    disconnect("renewal-failed");
    throw new SessionDisconnectedError();
  }

  const retry = await request(replacement);
  if (retry.status === 401) {
    disconnect("renewal-failed");
    throw new SessionDisconnectedError();
  }
  return retry;
}
