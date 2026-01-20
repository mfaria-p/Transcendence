type EmitUserEventBody = {
  userIds: string[];
  event: string;
  payload?: unknown;
};

function getInternalEndpoint(): string | null {
  const base = process.env.REALTIME_INTERNAL_URL;
  if (!base || typeof base !== 'string') return null;
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/internal/user-event`;
}

/**
 * Emit a realtime event to one or more userIds.
 *
 * - Best-effort: never throws (so normal REST flows still work if ws is down)
 * - No return value is required by callers
 */
export async function emitUserEvent(userIds: string[], event: string, payload?: unknown): Promise<void> {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    if (typeof event !== 'string' || event.trim().length === 0) return;
    const url = getInternalEndpoint();
    const token = process.env.INTERNAL_WS_TOKEN;
    if (!url || !token) return;

    const body: EmitUserEventBody = {
      userIds: userIds.map(String).filter(Boolean),
      event,
      ...(payload !== undefined ? { payload } : {}),
    };

    if (body.userIds.length === 0) return;

    // Node 20+ has global fetch.
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // ignore (best-effort)
    });
  } catch {
    // ignore (best-effort)
  }
}

