export const PRESENCE_GRACE_MS = 8000;

/** Presence keys can have several tabs; reconcile distinct user IDs, not join/leave events. */
export function reconcilePresence(previous: ReadonlySet<string>, observed: ReadonlySet<string>, deadlines: Map<string, number>, now: number) {
  const effective = new Set(observed);
  const expired: string[] = [];
  for (const id of observed) deadlines.delete(id);
  for (const id of previous) {
    if (observed.has(id)) continue;
    const deadline = deadlines.get(id) ?? now + PRESENCE_GRACE_MS;
    if (deadline <= now) { deadlines.delete(id); expired.push(id); }
    else { deadlines.set(id, deadline); effective.add(id); }
  }
  return { effective, expired };
}
