let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let manualClose = false;

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
  const url = `${protocol}//${window.location.host}/ws/?token=${encodeURIComponent(token)}`;
  
  console.log('[Presence WS] Attempting to connect to:', url);
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[Presence WS] Connection established successfully');
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      console.log('[Presence WS] Cleared reconnect timer');
    }
    
    // Send subscribe message
    const subscribeMsg = JSON.stringify({ type: 'subscribe_presence' });
    console.log('[Presence WS] Sending subscribe message:', subscribeMsg);
    ws?.send(subscribeMsg);
  };

  ws.onmessage = (event) => {
    console.log('[Presence WS] Message received:', event.data);
    try {
      const message = JSON.parse(event.data);
      console.log('[Presence WS] Parsed message:', message);
      
      switch (message.type) {
        case 'hello':
          console.log('[Presence WS] Hello message received. UserId:', message.userId, 'Online users:', message.onlineUsers);
          break;
        case 'presence':
          console.log(`[Presence WS] Presence update: User ${message.userId} is now ${message.event}`);
          break;
        case 'pong':
          console.log('[Presence WS] Pong received');
          break;
        default:
          console.log('[Presence WS] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Presence WS] Failed to parse message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('[Presence WS] WebSocket error:', error);
    console.error('[Presence WS] Error details:', {
      readyState: ws?.readyState,
      url: ws?.url,
      protocol: ws?.protocol
    });
  };

  ws.onclose = (event) => {
    console.log('[Presence WS] Connection closed:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      manualClose: manualClose
    });
    
    ws = null;
    
    if (!manualClose && localStorage.getItem('access_token')) {
      console.log('[Presence WS] Will attempt to reconnect in 2 seconds...');
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
    console.log('[Presence WS] Cleared reconnect timer');
  }

  if (ws) {
    console.log('[Presence WS] Closing WebSocket connection');
    ws.close();
    ws = null;
  }
  
  console.log('[Presence WS] Disconnected');
}