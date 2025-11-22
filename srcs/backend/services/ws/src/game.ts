// src/game.ts

import type WebSocket from 'ws';

export interface GameMessage {
    type: string;
    [key: string]: unknown;
}

/**
 * Stub para futura lógica de Pong server-side.
 * Aqui vais poder:
 *  - gerir rooms (por ex. roomId)
 *  - manter estado da bola/paddles
 *  - processar inputs e broadcast do estado
 */
export function handleGameMessage(
    userId: string,
    socket: WebSocket,
    msg: GameMessage,
): void {
    if (socket.readyState === socket.OPEN) {
        socket.send(
            JSON.stringify({
                type: 'game:unimplemented',
                message: 'Server-side game logic not implemented yet',
                received: msg,
            }),
        );
    }
}
