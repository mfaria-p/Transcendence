// src/presence.ts

import type WebSocket from 'ws';

type UserId = string;

const connectionsByUser = new Map<UserId, Set<WebSocket>>();

export function getUserSockets(userId: string): Set<WebSocket> | undefined {
    return connectionsByUser.get(userId);
}

export function sendToUser(userId: string, payload: unknown): void {
    const sockets = connectionsByUser.get(userId);
    if (!sockets || sockets.size === 0) return;

    const json = JSON.stringify(payload);
    for (const socket of sockets) {
        if (socket.readyState === socket.OPEN) {
            socket.send(json);
        }
    }
}

export function broadcast(payload: unknown): void {
    const json = JSON.stringify(payload);
    for (const sockets of connectionsByUser.values()) {
        for (const socket of sockets) {
            if (socket.readyState === socket.OPEN) {
                socket.send(json);
            }
        }
    }
}

export function addConnection(userId: string, socket: WebSocket): { firstConnection: boolean } {
    let set = connectionsByUser.get(userId);
    if (!set) {
        set = new Set<WebSocket>();
        connectionsByUser.set(userId, set);
    }
    const sizeBefore = set.size;
    set.add(socket);
    return { firstConnection: sizeBefore === 0 };
}

export function removeConnection(userId: string, socket: WebSocket): { lastConnection: boolean } {
    const set = connectionsByUser.get(userId);
    if (!set) {
        return { lastConnection: false };
    }
    set.delete(socket);
    if (set.size === 0) {
        connectionsByUser.delete(userId);
        return { lastConnection: true };
    }
    return { lastConnection: false };
}

export function isOnline(userId: string): boolean {
    return connectionsByUser.has(userId);
}

export function getOnlineUsers(): string[] {
    return Array.from(connectionsByUser.keys());
}

export function forEachConnection(
    fn: (userId: string, socket: WebSocket) => void,
): void {
    for (const [uid, sockets] of connectionsByUser) {
        for (const socket of sockets) {
            fn(uid, socket);
        }
    }
}
