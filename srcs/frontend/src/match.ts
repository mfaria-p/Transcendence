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
	isTournament?: boolean;
	tournamentId?: string | null;
	matchId?: string | null;
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
	private userNameCache = new Map<string, string>();
	private fetchingNames = new Set<string>();
	private tournamentName: string | null = null;
	private confettiFrame: number | null = null;
	private lottieLoader: Promise<any> | null = null;
	private championAnimationInstance: any | null = null;
	private championShownFor = new Set<string>();
	private loserAnimationInstance: any | null = null;
	private loserShownFor = new Set<string>();
	private countdownOverlay: HTMLElement | null = null;
	private countdownValueEl: HTMLElement | null = null;
	private countdownInterval: number | null = null;
	private countdownActive = false;
	private keyDownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);
	private keyUpHandler = (event: KeyboardEvent) => this.handleKeyUp(event);
	private beforeUnloadHandler = () => this.dispose();
	private tournamentId: string | null;
	private matchId: string | null;
	private isTournamentMatch = false;
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
		this.isTournamentMatch = Boolean(this.tournamentId);
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
		this.setupCountdownOverlay();
		this.setupChampionOverlay();
		this.setupLoserOverlay();
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
			const tournamentName = data.tournament?.name as string | undefined;
			if (tournamentName && tournamentName.trim().length > 0) {
				this.tournamentName = tournamentName;
				this.setRoomName(tournamentName);
			}
			if (data.tournament?.status === 'finished') {
				showMessage('This tournament has finished. Redirecting...', 'error');
				setTimeout(() => (window.location.href = './tournaments.html'), 1200);
				return;
			}
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
		this.setRoomName(this.roomId ?? '');
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

		if (typeof payload.isTournament === 'boolean') {
			this.isTournamentMatch = payload.isTournament;
		}
		if (payload.tournamentId) this.tournamentId = payload.tournamentId;
		if (payload.matchId) this.matchId = payload.matchId;

		if (payload.ready) {
			this.readyFlags = { ...payload.ready };
		}

		this.gameStatus = payload.status;
		if (payload.status === 'playing') {
			this.stopCountdownUI();
		}

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
		this.stopCountdownUI();
		this.updateScores(payload.scores);
		this.setStatus('Match finished.');
		const isWinner = normalizeId(payload.winnerUserId) === this.normalizedUser.id;
		const winnerText = payload.winnerUserId
			? isWinner
				? 'You won the match!'
				: `Winner: ${this.formatPlayer(payload.winnerUserId)}`
			: 'Match ended.';
		this.showInlineMessage(winnerText, isWinner ? 'success' : 'error');
		if (payload.isTournament) {
			if (isWinner) {
				this.startConfetti();
				void this.maybeShowChampionOverlay(payload);
			} else {
				void this.maybeShowLoserOverlay(payload);
			}
		}
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

		if (payload.roomId && !this.tournamentName) {
			// keep showing current label; tournament name is resolved via snapshot
			this.setRoomName(this.tournamentName ?? this.roomId);
		}

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

		this.updateReadyBadges(players);

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
			this.maybeHandleCountdown(players);
			return;
		}

		controlHint.textContent = `${selfReady ? 'You are ready' : 'Press SPACE to Ready'} · ${opponentReady ? 'Opponent ready' : 'Opponent not ready'} | Controls: W/S or ↑/↓`;
		this.updateReadyButton(selfReady, selfReady ? 'Ready ✓' : 'Press SPACE to Ready');
		this.maybeHandleCountdown(players);
	}

	private updateReadyBadges(players: { left: string | null; right: string | null }): void {
		const leftBadge = document.getElementById('leftReadyBadge');
		const rightBadge = document.getElementById('rightReadyBadge');

		const showLeft = this.gameStatus === 'waiting' && Boolean(players.left) && this.readyFlags.left;
		const showRight = this.gameStatus === 'waiting' && Boolean(players.right) && this.readyFlags.right;

		if (leftBadge) leftBadge.classList.toggle('hidden', !showLeft);
		if (rightBadge) rightBadge.classList.toggle('hidden', !showRight);
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

	private maybeHandleCountdown(players: { left: string | null; right: string | null }): void {
		if (!this.isTournamentMatch) {
			this.stopCountdownUI();
			return;
		}
		if (this.gameStatus !== 'waiting') {
			this.stopCountdownUI();
			return;
		}
		if (!players.left || !players.right) {
			this.stopCountdownUI();
			return;
		}

		const selfReady = this.isSelfReady();
		const opponentReady = this.isOpponentReady(players);
		if (selfReady && opponentReady) {
			this.startCountdownUI();
		} else {
			this.stopCountdownUI();
		}
	}

	private updatePlayers(players: { left: string | null; right: string | null }): void {
		const leftLabel = document.getElementById('leftPlayerLabel');
		const rightLabel = document.getElementById('rightPlayerLabel');

		if (leftLabel) leftLabel.textContent = this.getDisplayNameSync(players.left);
		if (rightLabel) rightLabel.textContent = this.getDisplayNameSync(players.right);

		void this.loadUsernames(players);
	}

	private updateScores(scores: { left: number; right: number }): void {
		const leftScore = document.getElementById('leftPlayerScore');
		const rightScore = document.getElementById('rightPlayerScore');
		if (leftScore) leftScore.textContent = scores.left.toString();
		if (rightScore) rightScore.textContent = scores.right.toString();
	}

	private setupCountdownOverlay(): void {
		this.countdownOverlay = document.getElementById('countdownOverlay');
		this.countdownValueEl = document.getElementById('countdownValue');
	}

	private startCountdownUI(): void {
		if (this.countdownActive) return;
		const overlay = this.countdownOverlay ?? document.getElementById('countdownOverlay');
		const valueEl = this.countdownValueEl ?? document.getElementById('countdownValue');
		if (!overlay || !valueEl) return;
		this.countdownOverlay = overlay;
		this.countdownValueEl = valueEl;
		this.countdownActive = true;

		const steps = ['3', '2', '1', 'START!'];
		let step = 0;
		overlay.classList.remove('hidden');
		overlay.classList.add('flex');
		valueEl.textContent = steps[step];

		this.countdownInterval = window.setInterval(() => {
			step += 1;
			if (step >= steps.length) {
				this.stopCountdownUI();
				return;
			}
			valueEl.textContent = steps[step];
			if (step === steps.length - 1) {
				window.setTimeout(() => this.stopCountdownUI(), 600);
			}
		}, 1000);
	}

	private stopCountdownUI(): void {
		if (this.countdownInterval !== null) {
			window.clearInterval(this.countdownInterval);
			this.countdownInterval = null;
		}
		this.countdownActive = false;
		const overlay = this.countdownOverlay ?? document.getElementById('countdownOverlay');
		if (overlay) {
			overlay.classList.add('hidden');
			overlay.classList.remove('flex');
		}
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
		return this.getDisplayNameSync(userId);
	}

	private getDisplayNameSync(userId: string | null): string {
		const normalized = normalizeId(userId);
		if (!normalized) return 'TBD';
		if (normalized === this.normalizedUser.id) return `${this.normalizedUser.username} (you)`;
		const cached = this.userNameCache.get(normalized);
		return cached ?? normalized;
	}

	private async loadUsernames(players: { left: string | null; right: string | null }): Promise<void> {
		const ids = [players.left, players.right]
			.map((id) => normalizeId(id))
			.filter((id): id is string => Boolean(id) && id !== this.normalizedUser.id);

		for (const id of ids) {
			if (this.userNameCache.has(id) || this.fetchingNames.has(id)) continue;
			this.fetchingNames.add(id);
			try {
				const profile = await this.fetchUserProfile(id);
				const display = profile?.name || profile?.username || profile?.id || id;
				this.userNameCache.set(id, display);
				this.updatePlayers({ ...this.players });
			} catch (err) {
				console.warn('Failed to fetch username for', id, err);
			} finally {
				this.fetchingNames.delete(id);
			}
		}
	}

	private async fetchUserProfile(userId: string): Promise<{ name?: string; username?: string; id?: string } | null> {
		try {
			const res = await fetch(`/api/user/${userId}`, {
				headers: { 'Authorization': `Bearer ${this.token}` },
			});
			if (!res.ok) return null;
			const data = await res.json();
			return (data as any).profile ?? null;
		} catch (err) {
			return null;
		}
	}

	private async fetchTournament(tournamentId: string): Promise<{ status?: string; winnerId?: string; name?: string } | null> {
		try {
			const res = await fetch(`/api/realtime/tournaments/${tournamentId}`, {
				headers: { 'Authorization': `Bearer ${this.token}` },
			});
			if (!res.ok) return null;
			const data = await res.json().catch(() => null);
			return (data as any)?.tournament ?? null;
		} catch (err) {
			console.warn('fetchTournament failed', err);
			return null;
		}
	}

	private setStatus(message: string): void {
		const statusEl = document.getElementById('statusText');
		if (statusEl) {
			statusEl.textContent = message;
		}
	}

	private setRoomName(display: string): void {
		const roomLabel = document.getElementById('roomLabel');
		const roomText = document.getElementById('roomIdText');
		const title = document.getElementById('matchTitle');
		const subtitle = document.getElementById('roomSubtitle');

		if (roomLabel) roomLabel.textContent = 'Tournament:';
		if (roomText) roomText.textContent = display;
		if (title) title.textContent = display || 'Match';
		if (subtitle) subtitle.textContent = 'Tournament match';
	}

	private startConfetti(): void {
		const duration = 3800;
		const end = performance.now() + duration;
		const canvas = document.createElement('canvas');
		canvas.id = 'confetti-canvas';
		canvas.style.position = 'fixed';
		canvas.style.inset = '0';
		canvas.style.pointerEvents = 'none';
		canvas.style.zIndex = '13000';
		document.body.appendChild(canvas);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			canvas.remove();
			return;
		}

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		resize();
		window.addEventListener('resize', resize);

		const colors = ['#10b981', '#22d3ee', '#f59e0b', '#ef4444', '#8b5cf6'];
		const particles = Array.from({ length: 160 }, () => ({
			x: Math.random() * canvas.width,
			y: Math.random() * canvas.height - canvas.height,
			size: Math.random() * 6 + 4,
			speedY: Math.random() * 4 + 2,
			speedX: Math.random() * 2 - 1,
			color: colors[Math.floor(Math.random() * colors.length)],
		}));

		const fadeWindow = 800; // ms used to fade-out near the end
		const draw = () => {
			const now = performance.now();
			const remaining = end - now;
			const alpha = remaining < fadeWindow ? Math.max(remaining / fadeWindow, 0) : 1;

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.globalAlpha = alpha;
			for (const p of particles) {
				p.x += p.speedX;
				p.y += p.speedY;
				if (p.y > canvas.height) {
					p.y = -10;
					p.x = Math.random() * canvas.width;
				}
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.rect(p.x, p.y, p.size, p.size * 0.6);
				ctx.fill();
			}
			ctx.globalAlpha = 1;

			if (remaining > 0) {
				this.confettiFrame = requestAnimationFrame(draw);
			} else {
				this.stopConfetti(canvas, resize);
			}
		};

		this.confettiFrame = requestAnimationFrame(draw);
	}

	private stopConfetti(canvas: HTMLCanvasElement, resizeHandler: () => void): void {
		if (this.confettiFrame !== null) {
			cancelAnimationFrame(this.confettiFrame);
			this.confettiFrame = null;
		}
		window.removeEventListener('resize', resizeHandler);
		canvas.remove();
	}

	private async loadLottie(): Promise<any> {
		if ((window as any).lottie) return (window as any).lottie;
		if (this.lottieLoader) return this.lottieLoader;

		const sources = [
			'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js',
			'https://unpkg.com/lottie-web@5.12.2/build/player/lottie.min.js',
		];

		this.lottieLoader = new Promise((resolve, reject) => {
			let idx = 0;
			const tryNext = () => {
				if (idx >= sources.length) {
					reject(new Error('Failed to load lottie-web'));
					return;
				}
				const url = sources[idx++];
				const script = document.createElement('script');
				script.src = url;
				script.async = true;
				script.onload = () => resolve((window as any).lottie);
				script.onerror = () => tryNext();
				document.head.appendChild(script);
			};
			tryNext();
		});

		return this.lottieLoader;
	}

	private setupChampionOverlay(): void {
		const closeBtn = document.getElementById('championClose');
		const overlay = document.getElementById('championOverlay');

		closeBtn?.addEventListener('click', () => {
			this.hideChampionOverlay();
			window.location.href = './tournaments.html';
		});

		overlay?.addEventListener('click', (ev) => {
			if (ev.target === overlay) this.hideChampionOverlay();
		});
	}

	private setupLoserOverlay(): void {
		const closeBtn = document.getElementById('loserClose');
		const overlay = document.getElementById('loserOverlay');

		closeBtn?.addEventListener('click', () => {
			this.hideLoserOverlay();
			window.location.href = './tournaments.html';
		});
		overlay?.addEventListener('click', (ev) => {
			if (ev.target === overlay) this.hideLoserOverlay();
		});
	}

	private hideChampionOverlay(): void {
		const overlay = document.getElementById('championOverlay');
		const animationContainer = document.getElementById('championAnimation');

		overlay?.classList.add('hidden');
		overlay?.classList.remove('flex');

		if (this.championAnimationInstance && typeof this.championAnimationInstance.destroy === 'function') {
			this.championAnimationInstance.destroy();
		}
		this.championAnimationInstance = null;
		animationContainer && (animationContainer.innerHTML = '');
	}

	private hideLoserOverlay(): void {
		const overlay = document.getElementById('loserOverlay');
		const animationContainer = document.getElementById('loserAnimation');

		overlay?.classList.add('hidden');
		overlay?.classList.remove('flex');

		if (this.loserAnimationInstance && typeof this.loserAnimationInstance.destroy === 'function') {
			this.loserAnimationInstance.destroy();
		}
		this.loserAnimationInstance = null;
		animationContainer && (animationContainer.innerHTML = '');
	}

	private async maybeShowChampionOverlay(payload: GameFinishedMessage): Promise<void> {
		if (!payload.isTournament || !payload.tournamentId || !payload.winnerUserId) return;
		if (normalizeId(payload.winnerUserId) !== this.normalizedUser.id) return;
		if (this.championShownFor.has(payload.tournamentId)) return;

		try {
			const tournament = await this.fetchTournament(payload.tournamentId);
			if (!tournament) return;
			if (tournament.status !== 'finished') return;
			if (normalizeId(tournament.winnerId) !== this.normalizedUser.id) return;
			this.championShownFor.add(payload.tournamentId);
			await this.showChampionOverlay(tournament.name ?? 'Torneio');
		} catch (err) {
			console.warn('Erro ao verificar campeão do torneio', err);
		}
	}

	private async maybeShowLoserOverlay(payload: GameFinishedMessage): Promise<void> {
		if (!payload.isTournament || !payload.tournamentId || !payload.winnerUserId) return;
		if (normalizeId(payload.winnerUserId) === this.normalizedUser.id) return;
		if (this.loserShownFor.has(payload.tournamentId)) return;

		try {
			const tournament = await this.fetchTournament(payload.tournamentId);
			if (!tournament) return;
			// If tournament already has a winner and it's not the current user, show once.
			if (normalizeId(tournament.winnerId) === this.normalizedUser.id) return;
			this.loserShownFor.add(payload.tournamentId);
			await this.showLoserOverlay(tournament.name ?? 'Torneio');
		} catch (err) {
			console.warn('Erro ao mostrar overlay de derrota', err);
		}
	}

	private async showChampionOverlay(tournamentName: string): Promise<void> {
		const overlay = document.getElementById('championOverlay');
		const textEl = document.getElementById('championText');
		const animationContainer = document.getElementById('championAnimation');

		if (!overlay || !textEl || !animationContainer) return;

		textEl.textContent = `You won the tournament "${tournamentName}"!`;

		overlay.classList.remove('hidden');
		overlay.classList.add('flex');
		overlay.classList.remove('opacity-0');

		await this.playChampionAnimation(animationContainer);
	}

	private async showLoserOverlay(tournamentName: string): Promise<void> {
		const overlay = document.getElementById('loserOverlay');
		const textEl = document.getElementById('loserText');
		const animationContainer = document.getElementById('loserAnimation');

		if (!overlay || !textEl || !animationContainer) return;

		textEl.textContent = `Tournament "${tournamentName}" - try again!`;

		overlay.classList.remove('hidden');
		overlay.classList.add('flex');
		overlay.classList.remove('opacity-0');

		await this.playLoserAnimation(animationContainer);
	}

	private async playChampionAnimation(container: HTMLElement): Promise<void> {
		try {
			const lottie = await this.loadLottie();
			if (!lottie) throw new Error('lottie não disponível');
			const animationData = await this.resolveLottieData('win');
			if (!animationData) throw new Error('win.json não encontrado');

			if (this.championAnimationInstance && typeof this.championAnimationInstance.destroy === 'function') {
				this.championAnimationInstance.destroy();
			}

			this.championAnimationInstance = lottie.loadAnimation({
				container,
				renderer: 'svg',
				loop: false,
				autoplay: true,
				animationData,
				rendererSettings: {
					preserveAspectRatio: 'xMidYMid meet',
				},
			});
			if (typeof this.championAnimationInstance.setSpeed === 'function') {
				this.championAnimationInstance.setSpeed(0.8);
			}
		} catch (err) {
			console.warn('Não foi possível tocar animação de campeão', err);
		}
	}

	private async playLoserAnimation(container: HTMLElement): Promise<void> {
		try {
			const lottie = await this.loadLottie();
			if (!lottie) throw new Error('lottie não disponível');
			const animationData = await this.resolveLottieData('lose');
			if (!animationData) throw new Error('lose.json não encontrado');

			if (this.loserAnimationInstance && typeof this.loserAnimationInstance.destroy === 'function') {
				this.loserAnimationInstance.destroy();
			}

			this.loserAnimationInstance = lottie.loadAnimation({
				container,
				renderer: 'svg',
				loop: false,
				autoplay: true,
				animationData,
				rendererSettings: {
					preserveAspectRatio: 'xMidYMid meet',
				},
			});
			if (typeof this.loserAnimationInstance.setSpeed === 'function') {
				this.loserAnimationInstance.setSpeed(0.8);
			}
		} catch (err) {
			console.warn('Não foi possível tocar animação de derrota', err);
		}
	}

	private async resolveLottieData(kind: 'win' | 'lose'): Promise<any | null> {
		const src = kind === 'win' ? WIN_LOTTIE_SRC : LOSE_LOTTIE_SRC;
		if (typeof src === 'string') {
			try {
				const res = await fetch(src);
				if (!res.ok) throw new Error(`Failed to fetch lottie: ${res.status}`);
				return await res.json();
			} catch (err) {
				console.warn('Failed to fetch lottie from URL', src, err);
				return null;
			}
		}
		return src;
	}

	private showInlineMessage(message: string, type: 'success' | 'error'): void {
		showMessage(message, type);
	}

	private dispose(): void {
		this.shouldReconnect = false;
		window.removeEventListener('keydown', this.keyDownHandler);
		window.removeEventListener('keyup', this.keyUpHandler);
		window.removeEventListener('beforeunload', this.beforeUnloadHandler);
		this.stopCountdownUI();

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

// Configure your Lottie sources here. Set to a URL (string) or leave as inline JSON.
// Example: const WIN_LOTTIE_SRC = '/static/win.json'; const LOSE_LOTTIE_SRC = '/static/lose.json';
// Use your custom Lottie file (relative path so it works under the same origin)
// If your app is served under a sub-path, keep this absolute-from-site-root. Ensure dist/assets/win.json exists in the built image.
const WIN_LOTTIE_SRC: string | object = '/assets/win.json';
const LOSE_LOTTIE_SRC: string | object = '/assets/lose.json';

