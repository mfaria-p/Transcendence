interface User {
	id: string;
	username: string;
	email: string;
}

type Direction = 'up' | 'down' | 'none';
type Side = 'left' | 'right';
type GameStatus = 'waiting' | 'playing' | 'finished';

interface ServerGameState {
	width: number;
	height: number;
	paddleWidth: number;
	paddleHeight: number;
	ballSize: number;
	leftY: number;
	rightY: number;
	ballX: number;
	ballY: number;
	ballVX: number;
	ballVY: number;
}

interface GameStateMessage {
	type: 'game:state';
	roomId: string;
	status: GameStatus;
	scores: { left: number; right: number };
	players: { left: string | null; right: string | null };
	ready?: { left: boolean; right: boolean };
	state: ServerGameState;
	yourSide?: Side;
}

interface GameFinishedMessage {
	type: 'game:finished';
	roomId: string;
	winnerUserId?: string;
	scores: { left: number; right: number };
	isTournament: boolean;
	tournamentId?: string | null;
	matchId?: string | null;
}

interface GameJoinedMessage {
	type: 'game:joined';
	roomId: string;
	yourSide: Side | null;
	ready: { left: boolean; right: boolean };
	players: { left: string | null; right: string | null };
	status: GameStatus;
}

interface GameErrorMessage {
	type: 'game:error';
	message?: string;
}

interface GameReadyAckMessage {
	type: 'game:ready:ack';
	roomId: string;
	ready: { left: boolean; right: boolean };
}

type KnownServerMessage =
	| GameStateMessage
	| GameFinishedMessage
	| GameErrorMessage
	| GameReadyAckMessage
	| GameJoinedMessage
	| { type: 'debug'; scope?: string; event?: string; data?: unknown; ts?: number }
	| { type: 'hello'; userId: string }
	| { type: 'pong'; ts?: number }
	| { type: 'presence'; event: string; userId: string }
	| { type: 'tournament:update'; tournament: unknown };

class TournamentMatchPage {
	private canvas: HTMLCanvasElement | null;
	private ctx: CanvasRenderingContext2D | null;
	private socket: WebSocket | null = null;
	private shouldReconnect = true;
	private reconnectAttempts = 0;
	private yourSide: Side | null = null;
	private currentDirection: Direction = 'none';
	private pressed = { up: false, down: false };
	private readyFlags = { left: false, right: false };
	private players: { left: string | null; right: string | null } = { left: null, right: null };
	private sentReady = false;
	private gameStatus: GameStatus = 'waiting';
	private readyButton: HTMLButtonElement | null = null;
	private keyDownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);
	private keyUpHandler = (event: KeyboardEvent) => this.handleKeyUp(event);
	private beforeUnloadHandler = () => this.dispose();
	private tournamentId: string | null;
	private matchId: string | null;
	private readonly normalizedUser: User;

	constructor(
		private readonly roomId: string,
		private readonly token: string,
		currentUser: User,
	) {
		this.normalizedUser = { ...currentUser, id: String((currentUser as any).id) };
		const ids = parseRoomIdentifiers(this.roomId);
		this.tournamentId = ids?.tournamentId ?? null;
		this.matchId = ids?.matchId ?? null;
		this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
		this.ctx = this.canvas?.getContext('2d') ?? null;
		console.log('[match] Constructor - initial state:', {
			normalizedUserId: this.normalizedUser.id,
			roomId: this.roomId,
			readyFlags: this.readyFlags,
			sentReady: this.sentReady,
			gameStatus: this.gameStatus
		});
		this.displayRoomId();
		this.setStatus('Connecting to server...');
		void this.fetchSnapshot();
		this.connect();
		this.setupControls();
	}

	private async fetchSnapshot(): Promise<void> {
		if (!this.tournamentId || !this.matchId) return;
		try {
			const res = await fetch(`/api/realtime/tournaments/${this.tournamentId}`, {
				headers: { 'Authorization': `Bearer ${this.token}` },
			});
			if (!res.ok) return;
			const data = await res.json();
			const match = (data.tournament?.matches as any[] | undefined)?.find((m) => m.id === this.matchId);
			if (!match) return;

			this.players = {
				left: normalizeId(match.player1Id),
				right: normalizeId(match.player2Id),
			};
			this.updatePlayers(this.players);
			this.updateScores({ left: 0, right: 0 });

			if (normalizeId(match.player1Id) === this.normalizedUser.id) {
				this.yourSide = 'left';
				this.updateSideHint();
			} else if (normalizeId(match.player2Id) === this.normalizedUser.id) {
				this.yourSide = 'right';
				this.updateSideHint();
			}

			if (match.status === 'finished') {
				this.setStatus('Match finished.');
				this.gameStatus = 'finished';
			} else if (match.status === 'playing') {
				this.setStatus('Match in progress!');
				this.gameStatus = 'playing';
			} else {
				this.setStatus('Room created. Waiting for opponent to join.');
				this.gameStatus = 'waiting';
			}

			this.updateReadyUI({
				left: normalizeId(match.player1Id),
				right: normalizeId(match.player2Id),
			});
		} catch (err) {
			console.warn('snapshot fetch failed', err);
		}
	}

	private displayRoomId(): void {
		const roomEl = document.getElementById('roomIdText');
		if (roomEl) {
			roomEl.textContent = this.roomId;
		}
	}

	private connect(): void {
		const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
		const wsUrl = `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(this.token)}`;
		console.log('[match] Connecting to WebSocket:', wsUrl);
		const socket = new WebSocket(wsUrl);
		this.socket = socket;

		socket.addEventListener('open', () => {
			console.log('[match] WebSocket connected!');
			this.reconnectAttempts = 0;
			this.setStatus('Connected! Preparing room...');
			const joinMsg = { type: 'game:join', roomId: this.roomId };
			console.log('[match] Sending game:join', joinMsg);
			socket.send(JSON.stringify(joinMsg));
		});

		socket.addEventListener('message', (event) => this.handleSocketMessage(event));
		socket.addEventListener('close', (event) => {
			console.log('[match] WebSocket closed', event.code, event.reason);
			this.handleSocketClose();
		});
		socket.addEventListener('error', (event) => {
			console.error('[match] WebSocket error', event);
			this.showInlineMessage('Realtime connection error.', 'error');
		});
	}

	private handleSocketMessage(event: MessageEvent<string>): void {
		let payload: KnownServerMessage;
		try {
			payload = JSON.parse(event.data);
		} catch {
			return;
		}

		switch (payload.type) {
			case 'game:state':
				this.handleGameState(payload);
				return;
			case 'game:finished':
				this.handleGameFinished(payload);
				return;
			case 'game:error':
				this.showInlineMessage(payload.message ?? 'Match error.', 'error');
				return;
			case 'game:ready:ack':
				this.handleReadyAck(payload);
				return;
			case 'game:joined':
				this.handleGameJoined(payload);
				return;
			case 'debug':
				this.handleDebug(payload);
				return;
			case 'hello':
			case 'pong':
			case 'presence':
			case 'tournament:update':
				return;
			default:
				console.debug('Ignored WS message', payload);
		}
	}

	private handleDebug(payload: { type: 'debug'; scope?: string; event?: string; data?: unknown; ts?: number }): void {
		const scope = payload.scope ?? 'debug';
		const event = payload.event ?? 'event';
		console.debug('[ws debug]', scope, event, payload.data);
		// debug only (no UI toast)
	}

	private handleGameState(payload: GameStateMessage): void {
		const players = {
			left: normalizeId(payload.players.left),
			right: normalizeId(payload.players.right),
		};
		this.players = players;

		if (payload.ready) {
			this.readyFlags = { ...payload.ready };
		}

		this.gameStatus = payload.status;

		if (payload.yourSide && payload.yourSide !== this.yourSide) {
			this.yourSide = payload.yourSide;
			this.updateSideHint();
		}

		// If the server did not include yourSide, infer it from the players list.
		if (!this.yourSide) {
			if (players.left === this.normalizedUser.id) {
				this.yourSide = 'left';
				this.updateSideHint();
			} else if (players.right === this.normalizedUser.id) {
				this.yourSide = 'right';
				this.updateSideHint();
			}
		}

		if (payload.status !== 'waiting') this.sentReady = false;

		this.updatePlayers(players);
		this.updateScores(payload.scores);
		this.updateStatusFromGame(payload, players);
		this.updateReadyUI(players);
		this.drawState(payload.state);
	}

	private handleGameFinished(payload: GameFinishedMessage): void {
		this.gameStatus = 'finished';
		this.readyFlags = { left: false, right: false };
		this.sentReady = false;
		this.updateScores(payload.scores);
		this.setStatus('Match finished.');
		const isWinner = normalizeId(payload.winnerUserId) === this.normalizedUser.id;
		const winnerText = payload.winnerUserId
			? isWinner
				? 'You won the match!'
				: `Winner: ${this.formatPlayer(payload.winnerUserId)}`
			: 'Match ended.';
		this.showInlineMessage(winnerText, isWinner ? 'success' : 'error');
		this.updateReadyUI({ left: null, right: null });
	}

	private handleGameJoined(payload: GameJoinedMessage): void {
		console.log('[match] Received game:joined', payload);
		this.players = {
			left: normalizeId(payload.players.left),
			right: normalizeId(payload.players.right),
		};
		this.readyFlags = { ...payload.ready };
		this.gameStatus = payload.status;

		if (payload.yourSide && payload.yourSide !== this.yourSide) {
			this.yourSide = payload.yourSide;
			this.updateSideHint();
		}

		this.updatePlayers(this.players);
		this.updateScores({ left: 0, right: 0 });
		this.updateStatusFromReadyState(this.players);
		this.updateReadyUI(this.players);
	}

	private handleReadyAck(payload: GameReadyAckMessage): void {
		console.log('[match] Received game:ready:ack', payload);
		this.readyFlags = { ...payload.ready };
		console.log('[match] Updated readyFlags to:', this.readyFlags);
		this.updateReadyUI(this.players);
		this.updateStatusFromReadyState(this.players);
	}

	private handleSocketClose(): void {
		this.socket = null;
		if (!this.shouldReconnect) return;

		this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 5);
		const delay = 1000 * this.reconnectAttempts;
		this.setStatus('Connection lost. Reconnecting...');
		window.setTimeout(() => this.connect(), delay);
	}

	private updateStatusFromGame(payload: GameStateMessage, players: { left: string | null; right: string | null }): void {
		if (payload.status === 'waiting') {
			this.updateStatusFromReadyState(players);
			return;
		}
		if (payload.status === 'playing') {
			this.setStatus('Match in progress!');
			return;
		}
		this.setStatus('Match finished.');
	}

	private updateStatusFromReadyState(players: { left: string | null; right: string | null }): void {
		const waitingOpponent = !players.left || !players.right;
		if (waitingOpponent) {
			this.setStatus('Room created. Waiting for opponent to join.');
			return;
		}

		const selfReady = this.isSelfReady();
		const opponentReady = this.isOpponentReady(players);
		if (selfReady && opponentReady) {
			this.setStatus('Both players ready. Starting...');
		} else if (selfReady) {
			this.setStatus('Ready. Waiting for opponent to press SPACE.');
		} else if (opponentReady) {
			this.setStatus('Opponent is ready. Press SPACE to get ready.');
		} else {
			this.setStatus('Press SPACE to get ready.');
		}
	}

	private isSelfReady(): boolean {
		if (this.yourSide === 'left') return this.readyFlags.left;
		if (this.yourSide === 'right') return this.readyFlags.right;
		// Fallback: check by player id if yourSide not set yet
		if (this.players.left === this.normalizedUser.id) return this.readyFlags.left;
		if (this.players.right === this.normalizedUser.id) return this.readyFlags.right;
		return false;
	}

	private isOpponentReady(players: { left: string | null; right: string | null }): boolean {
		if (this.yourSide === 'left') return this.readyFlags.right;
		if (this.yourSide === 'right') return this.readyFlags.left;
		if (players.left === this.normalizedUser.id) return this.readyFlags.right;
		if (players.right === this.normalizedUser.id) return this.readyFlags.left;
		return false;
	}

	private updateReadyUI(players: { left: string | null; right: string | null }): void {
		const controlHint = document.getElementById('controlHint');
		if (!controlHint) return;

		console.log('[match] updateReadyUI called', {
			gameStatus: this.gameStatus,
			players,
			readyFlags: this.readyFlags,
			yourSide: this.yourSide,
			isSelfReady: this.isSelfReady()
		});

		if (this.gameStatus !== 'waiting') {
			controlHint.textContent = 'Controls: use W/S or arrows.';
			this.updateReadyButton(false, 'Ready');
			return;
		}

		const waitingOpponent = !players.left || !players.right;
		const selfReady = this.isSelfReady();
		const opponentReady = this.isOpponentReady(players);

		if (waitingOpponent) {
			controlHint.textContent = 'Waiting for opponent to join | Press SPACE to Ready | Controls: W/S or ↑/↓';
			this.updateReadyButton(selfReady, selfReady ? 'Ready ✓' : 'Press SPACE to Ready');
			return;
		}

		controlHint.textContent = `${selfReady ? 'You are ready' : 'Press SPACE to Ready'} · ${opponentReady ? 'Opponent ready' : 'Opponent not ready'} | Controls: W/S or ↑/↓`;
		this.updateReadyButton(selfReady, selfReady ? 'Ready ✓' : 'Press SPACE to Ready');
	}

	private updateReadyButton(selfReady: boolean, label: string): void {
		if (!this.readyButton) return;
		console.log('[match] updateReadyButton called', { selfReady, label, gameStatus: this.gameStatus });
		this.readyButton.textContent = label;
		this.readyButton.disabled = selfReady || this.gameStatus !== 'waiting';
		this.readyButton.classList.toggle('opacity-50', this.readyButton.disabled);
		this.readyButton.classList.toggle('cursor-not-allowed', this.readyButton.disabled);
		this.readyButton.classList.toggle('bg-green-600', selfReady);
		this.readyButton.classList.toggle('hover:bg-green-500', selfReady);
		this.readyButton.classList.toggle('bg-blue-600', !selfReady);
		this.readyButton.classList.toggle('hover:bg-blue-500', !selfReady);
		console.log('[match] Button classes:', this.readyButton.className);
	}

	private updatePlayers(players: { left: string | null; right: string | null }): void {
		const leftLabel = document.getElementById('leftPlayerLabel');
		const rightLabel = document.getElementById('rightPlayerLabel');
		if (leftLabel) leftLabel.textContent = this.formatPlayer(players.left);
		if (rightLabel) rightLabel.textContent = this.formatPlayer(players.right);
	}

	private updateScores(scores: { left: number; right: number }): void {
		const leftScore = document.getElementById('leftPlayerScore');
		const rightScore = document.getElementById('rightPlayerScore');
		if (leftScore) leftScore.textContent = scores.left.toString();
		if (rightScore) rightScore.textContent = scores.right.toString();
	}

	private updateSideHint(): void {
		const sideEl = document.getElementById('sideHint');
		if (!sideEl) return;

		if (!this.yourSide) {
			sideEl.textContent = 'Waiting for side assignment...';
			return;
		}

		sideEl.textContent =
			this.yourSide === 'left'
				? 'You are on the left side (W/S)'
				: 'You are on the right side (↑/↓)';
	}

	private drawState(state: ServerGameState): void {
		if (!this.canvas || !this.ctx) return;
		const ctx = this.ctx;
		const width = this.canvas.width;
		const height = this.canvas.height;
		const scaleX = width / state.width;
		const scaleY = height / state.height;

		ctx.fillStyle = '#050505';
		ctx.fillRect(0, 0, width, height);

		ctx.setLineDash([8, 16]);
		ctx.strokeStyle = 'rgba(255,255,255,0.25)';
		ctx.beginPath();
		ctx.moveTo(width / 2, 0);
		ctx.lineTo(width / 2, height);
		ctx.stroke();
		ctx.setLineDash([]);

		const paddlePixelWidth = state.paddleWidth * scaleX;
		const paddlePixelHeight = state.paddleHeight * scaleY;

		ctx.fillStyle = '#f5f5f5';
		ctx.fillRect(0, state.leftY * scaleY, paddlePixelWidth, paddlePixelHeight);
		ctx.fillRect(
			width - paddlePixelWidth,
			state.rightY * scaleY,
			paddlePixelWidth,
			paddlePixelHeight,
		);

		ctx.fillRect(
			state.ballX * scaleX,
			state.ballY * scaleY,
			state.ballSize * scaleX,
			state.ballSize * scaleY,
		);
	}

	private setupControls(): void {
		window.addEventListener('keydown', this.keyDownHandler);
		window.addEventListener('keyup', this.keyUpHandler);
		window.addEventListener('beforeunload', this.beforeUnloadHandler);

		this.readyButton = document.getElementById('readyButton') as HTMLButtonElement | null;
		if (this.readyButton) {
			console.log('[match] Ready button found and wired');
			console.log('[match] Button initial state:', {
				disabled: this.readyButton.disabled,
				className: this.readyButton.className,
				textContent: this.readyButton.textContent
			});
			this.readyButton.addEventListener('click', () => {
				console.log('[match] Ready button clicked!');
				this.sendReadySignal();
			});
		} else {
			console.error('[match] Ready button NOT found!');
		}
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (event.code === 'Space' || event.key === ' ') {
			console.log('[match] SPACE key pressed', {
				gameStatus: this.gameStatus,
				sentReady: this.sentReady,
				isSelfReady: this.isSelfReady(),
				readyFlags: this.readyFlags,
				yourSide: this.yourSide
			});
			if (this.gameStatus === 'waiting') {
				event.preventDefault();
				this.sendReadySignal();
			}
			return;
		}

		const mapped = this.normalizeKey(event.key);
		if (!mapped) return;

		event.preventDefault();
		this.pressed[mapped] = true;
		this.pushDirection();
	}

	private handleKeyUp(event: KeyboardEvent): void {
		const mapped = this.normalizeKey(event.key);
		if (!mapped) return;

		event.preventDefault();
		this.pressed[mapped] = false;
		this.pushDirection();
	}

	private normalizeKey(key: string): 'up' | 'down' | null {
		if (key === 'w' || key === 'W' || key === 'ArrowUp') return 'up';
		if (key === 's' || key === 'S' || key === 'ArrowDown') return 'down';
		return null;
	}

	private pushDirection(): void {
		const next: Direction = this.pressed.up && !this.pressed.down
			? 'up'
			: this.pressed.down && !this.pressed.up
			? 'down'
			: 'none';

		if (next === this.currentDirection) return;
		this.currentDirection = next;
		this.sendInput(next);
	}

	private sendInput(direction: Direction): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify({ type: 'game:input', direction }));
	}

	private sendReadySignal(): void {
		console.log('[match] sendReadySignal called');
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.log('[match] Socket not open');
			return;
		}
		if (this.gameStatus !== 'waiting') {
			console.log('[match] Game not waiting');
			return;
		}
		console.log('[match] Sending game:ready');
		this.socket.send(JSON.stringify({ type: 'game:ready' }));
		this.sentReady = true;
	}

	private formatPlayer(userId: string | null): string {
		const normalized = normalizeId(userId);
		if (!normalized) return 'TBD';
		if (normalized === this.normalizedUser.id) {
			return `${this.normalizedUser.username} (you)`;
		}
		return normalized;
	}

	private setStatus(message: string): void {
		const statusEl = document.getElementById('statusText');
		if (statusEl) {
			statusEl.textContent = message;
		}
	}

	private showInlineMessage(message: string, type: 'success' | 'error'): void {
		showMessage(message, type);
	}

	private dispose(): void {
		this.shouldReconnect = false;
		window.removeEventListener('keydown', this.keyDownHandler);
		window.removeEventListener('keyup', this.keyUpHandler);
		window.removeEventListener('beforeunload', this.beforeUnloadHandler);

		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({ type: 'game:leave' }));
		}
		this.socket?.close();
	}
}

function getRoomIdFromUrl(): string | null {
	const params = new URLSearchParams(window.location.search);
	const roomId = params.get('roomId');
	return roomId && roomId.trim().length > 0 ? roomId : null;
}

function parseRoomIdentifiers(roomId: string | null): { tournamentId: string; matchId: string } | null {
	if (!roomId) return null;
	if (!roomId.startsWith('room_')) return null;
	// room format: room_<tournamentId>_<matchId>
	// matchId already has prefix m_, so split on "_m_" to avoid breaking tournamentId
	const payload = roomId.slice('room_'.length);
	const marker = '_m_';
	const markerIndex = payload.indexOf(marker);
	if (markerIndex === -1) return null;
	const tournamentId = payload.slice(0, markerIndex);
	const matchIdRest = payload.slice(markerIndex + 1); // keeps leading 'm'
	if (!tournamentId || !matchIdRest.startsWith('m_')) return null;
	return { tournamentId, matchId: matchIdRest };
}

function normalizeId(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return String(value);
}

function normalizeUser(user: User): User {
	return { ...user, id: String((user as any).id) };
}

function renderAuth(container: HTMLElement, user: User): void {
	container.innerHTML = `
		<span class="text-gray-300">Olá, <a href="./profile.html" class="text-green-400 hover:text-green-300 font-semibold underline transition">${user.username}</a></span>
		<button id="logoutButton" class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition">Logout</button>
	`;

	const logoutButton = document.getElementById('logoutButton');
	logoutButton?.addEventListener('click', async () => {
		try {
			await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
		} catch (err) {
			console.error('logout error', err);
		} finally {
			localStorage.removeItem('access_token');
			localStorage.removeItem('user');
			window.location.href = './login.html';
		}
	});
}

function showMessage(message: string, type: 'success' | 'error'): void {
	const container = document.getElementById('messageContainer');
	if (!container) return;

	const el = document.createElement('div');
	el.className = `${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-4 py-3 rounded shadow-lg transition-opacity`;
	el.textContent = message;
	container.appendChild(el);

	setTimeout(() => {
		el.style.opacity = '0';
		setTimeout(() => el.remove(), 300);
	}, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
	const roomId = getRoomIdFromUrl();
	const userStr = localStorage.getItem('user');
	const token = localStorage.getItem('access_token');

	if (!userStr || !token) {
		window.location.href = './login.html';
		return;
	}

	let user: User;
	try {
		user = JSON.parse(userStr) as User;
	} catch (err) {
		console.error('Error reading user from localStorage', err);
		localStorage.removeItem('user');
		localStorage.removeItem('access_token');
		window.location.href = './login.html';
		return;
	}

	const authContainer = document.getElementById('authContainer');
	if (authContainer) {
		renderAuth(authContainer, user);
	}

	if (!roomId) {
		showMessage('RoomId not provided in URL.', 'error');
		const statusEl = document.getElementById('statusText');
		if (statusEl) statusEl.textContent = 'Invalid room';
		return;
	}

	const normalizedUser = normalizeUser(user);
	console.log('[match] DOMContentLoaded - creating TournamentMatchPage');
	console.log('[match] readyButton exists in DOM?', !!document.getElementById('readyButton'));
	new TournamentMatchPage(roomId, token, normalizedUser);
});

