// src/realtime.ts

/**
 * Pushes a user-scoped real-time event to the ws-service, so it can deliver the
 * notification to all active WebSocket connections for the target user(s).
 *
 * NOTE: This is best-effort. Database writes must not fail just because the
 * realtime service is down.
 */
export async function pushUserEvent(
  userIds: string[],
  event: string,
  data?: unknown,
): Promise<void> {
  const baseUrl = (process.env.WS_SERVICE_URL ?? 'http://ws:3003').replace(/\/$/, '');
  const token = process.env.INTERNAL_WS_TOKEN;
  if (!token) {
    // If the token is not configured, we silently skip realtime.
    return;
  }

  const url = `${baseUrl}/internal/user-event`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify({ userIds, event, data }),
    });
  } catch {
    // ignore (best-effort)
  }
}
