// src/events.ts

import { broadcast, sendToUser } from './presence.js';
import type { Tournament } from './tournament.js';

export type RealtimeEventMessage =
  | { type: 'tournaments:changed'; ts: number }
  | { type: 'tournament:update'; tournament: Tournament; ts: number }
  | { type: 'user:event'; event: string; data?: unknown; ts: number };

/**
 * Broadcasts a "tournaments list changed" signal to all connected clients.
 *
 * This message intentionally contains no tournament data to avoid leaking
 * private tournaments. Clients should re-fetch using the authenticated
 * /api/realtime/tournaments endpoint.
 */
export function emitTournamentsChanged(): void {
  broadcast({ type: 'tournaments:changed', ts: Date.now() });
}

/**
 * Sends a full tournament snapshot to all players (and the owner).
 */
export function emitTournamentUpdate(tournament: Tournament): void {
  const ts = Date.now();
  const msg: RealtimeEventMessage = { type: 'tournament:update', tournament, ts };
  // tournament.players already contains ownerId in our current implementation,
  // but we keep ownerId explicitly just in case.
  const recipients = new Set<string>([tournament.ownerId, ...tournament.players]);
  for (const userId of recipients) {
    sendToUser(userId, msg);
  }
}

/**
 * Sends a user-scoped event to a specific set of users.
 */
export function emitUserEvent(userIds: string[], event: string, data?: unknown): void {
  const ts = Date.now();
  const msg: RealtimeEventMessage = { type: 'user:event', event, data, ts };
  const recipients = new Set<string>(userIds.filter(Boolean));
  for (const userId of recipients) {
    sendToUser(userId, msg);
  }
}
