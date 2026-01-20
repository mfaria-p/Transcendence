let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let manualClose = false;

type PresenceListener = (event: 'online' | 'offline', userId: string) => void;
const presenceListeners: Set<PresenceListener> = new Set();

type TournamentsListener = (payload: { tournaments: unknown[] }) => void;
const tournamentsListeners: Set<TournamentsListener> = new Set();

type UserEventListener = (event: string, payload?: unknown) => void;
const userEventListeners: Set<UserEventListener> = new Set();

export function addPresenceListener(listener: PresenceListener): void {
  presenceListeners.add(listener);
}

export function removePresenceListener(listener: PresenceListener): void {
  presenceListeners.delete(listener);
}

export function addTournamentsListener(listener: TournamentsListener): void {
  tournamentsListeners.add(listener);
}

export function removeTournamentsListener(listener: TournamentsListener): void {
  tournamentsListeners.delete(listener);
}

export function addUserEventListener(listener: UserEventListener): void {
  userEventListeners.add(listener);
}

export function removeUserEventListener(listener: UserEventListener): void {
  userEventListeners.delete(listener);
}

function notifyPresenceListeners(event: 'online' | 'offline', userId: string): void {
  presenceListeners.forEach((listener) => {
    try {
      listener(event, userId);
    } catch {
    }
  });
}

function notifyTournamentsListeners(tournaments: unknown[]): void {
  tournamentsListeners.forEach((listener) => {
    try {
      listener({ tournaments });
    } catch {
    }
  });
}

function notifyUserEventListeners(eventName: string, payload?: unknown): void {
  userEventListeners.forEach((listener) => {
    try {
      listener(eventName, payload);
    } catch {
    }
  });
}

export function connectPresenceSocket(): void {
  const token = localStorage.getItem('access_token');

  if (!token) {
    console.log('[Presence WS] No access token found, skipping connection');
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log('[Presence WS] Already connected or connecting, readyState:', ws.readyState);
    return;
  }

  manualClose = false;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[Presence WS] Connection established successfully');
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Send subscribe message
    const subscribeMsg = JSON.stringify({ type: 'subscribe_presence' });
    ws?.send(subscribeMsg);
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'hello':
          // optional debug
          break;

        case 'presence':
          notifyPresenceListeners(message.event, String(message.userId));
          break;

        case 'pong':
          break;

        case 'tournaments:update':
          notifyTournamentsListeners(message.tournaments ?? []);
          break;

        case 'user:event':
          notifyUserEventListeners(String(message.event ?? ''), message.payload);
          break;

        default:
          // optional debug
          break;
      }
    } catch {
    }
  };

  ws.onerror = () => {
  };

  ws.onclose = (event) => {
    console.log('[Presence WS] Connection closed:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      manualClose: manualClose,
    });

    ws = null;

    if (!manualClose && localStorage.getItem('access_token')) {
      reconnectTimer = window.setTimeout(() => {
        console.log('[Presence WS] Attempting reconnection...');
        connectPresenceSocket();
      }, 2000);
    } else {
      console.log('[Presence WS] Not reconnecting (manual close or no token)');
    }
  };
}

export function disconnectPresenceSocket(): void {
  console.log('[Presence WS] Disconnecting manually...');
  manualClose = true;

  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  presenceListeners.clear();
  tournamentsListeners.clear();
  userEventListeners.clear();

  console.log('[Presence WS] Disconnected');
}
