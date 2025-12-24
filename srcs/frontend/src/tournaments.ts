interface User {
  id: string;
  username: string;
  email: string;
}

interface TournamentMatch {
  id: string;
  roomId: string;
  player1Id: string | null;
  player2Id: string | null;
  status: 'pending' | 'playing' | 'finished';
  winnerId?: string;
  sourceMatch1Id?: string;
  sourceMatch2Id?: string;
  isFinal?: boolean;
}

interface Tournament {
  id: string;
  name?: string;
  ownerId: string;
  maxPlayers: number;
  status: 'waiting' | 'running' | 'finished';
  players: string[];
  matches: TournamentMatch[];
  winnerId?: string;
  createdAt: number;
  updatedAt: number;
}

class TournamentsPage {
  private currentUser: User | null = null;
  private accessToken: string | null = null;
  private isLoading = false;
  private nameCache = new Map<string, string>();
  private fetchingNames = new Set<string>();
  private tournamentsCache: Tournament[] = [];

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const userStr = localStorage.getItem('user');
    this.accessToken = localStorage.getItem('access_token');

    if (!userStr || !this.accessToken) {
      window.location.href = './login.html';
      return;
    }

    try {
      this.currentUser = JSON.parse(userStr);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      window.location.href = './login.html';
      return;
    }

    this.setupAuthContainer();
    this.setupEventListeners();
    await this.loadTournaments();
  }

  private setupAuthContainer(): void {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer || !this.currentUser) return;

    authContainer.innerHTML = `
      <a href="./index.html" class="text-gray-300 hover:text-white transition">Game</a>
      <span class="text-gray-400">|</span>
      <a href="./tournaments.html" class="text-green-400">Tournaments</a>
      <span class="text-gray-400">|</span>
      <span class="text-gray-300">Hello, <a href="./profile.html" class="text-green-300 hover:text-green-200 font-semibold underline transition duration-200">${this.currentUser.username}</a></span>
      <button id="logoutButton" class="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded transition duration-200">
        Logout
      </button>
    `;

    document.getElementById('logoutButton')?.addEventListener('click', () => this.handleLogout());
  }

  private setupEventListeners(): void {
    const form = document.getElementById('createTournamentForm') as HTMLFormElement | null;
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.createTournament();
    });

    document.getElementById('refreshButton')?.addEventListener('click', () => {
      void this.loadTournaments();
    });
  }

  private async loadTournaments(): Promise<void> {
    if (!this.accessToken || this.isLoading) return;
    this.isLoading = true;
    this.toggleLoadingState(true);

    try {
      const response = await fetch('/api/realtime/tournaments', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load tournaments (${response.status})`);
      }

      const data = await response.json();
      const tournaments: Tournament[] = data.tournaments ?? [];
      // show most recent first (by update/creation timestamp)
      const sorted = [...tournaments].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
      this.tournamentsCache = sorted;
      this.renderTournaments(sorted);
    } catch (error) {
      console.error('loadTournaments error:', error);
      this.showMessage('Unable to load tournaments.', 'error');
    } finally {
      this.isLoading = false;
      this.toggleLoadingState(false);
    }
  }

  private toggleLoadingState(isLoading: boolean): void {
    const refreshButton = document.getElementById('refreshButton') as HTMLButtonElement | null;
    if (refreshButton) {
      refreshButton.disabled = isLoading;
      refreshButton.classList.toggle('opacity-50', isLoading);
      refreshButton.classList.toggle('cursor-not-allowed', isLoading);
    }
  }

  private renderTournaments(tournaments: Tournament[]): void {
    const list = document.getElementById('tournamentsList');
    const emptyState = document.getElementById('tournamentsEmpty');
    if (!list || !emptyState) return;

    list.innerHTML = '';

    if (tournaments.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    for (const tournament of tournaments) {
      const card = document.createElement('article');
      card.className = 'bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-lg';

      const isOwner = tournament.ownerId === this.currentUser?.id;
      const isParticipant = tournament.players.includes(this.currentUser?.id ?? '');
      const hasOpenSlot = tournament.players.length < tournament.maxPlayers;
      const canJoin =
        (tournament.status === 'waiting' && hasOpenSlot) ||
        (tournament.status === 'running' && tournament.maxPlayers === 2 && hasOpenSlot);
      const canStart = isOwner && tournament.status === 'waiting' && tournament.players.length >= 2;
      const activeMatch = this.getCurrentMatchForUser(tournament);

      const statusClasses = this.getStatusClasses(tournament.status);
      const playersList = tournament.players.length > 0
        ? tournament.players.map((id) => this.formatPlayer(id)).join(', ')
        : 'No players joined yet';

      const matches = this.renderMatches(tournament.matches);

      card.innerHTML = `
        <div class="flex flex-col gap-4">
          <header class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="text-xl font-semibold">${this.getTournamentName(tournament)}</h3>
              <p class="text-sm text-gray-400">ID: <code>${tournament.id}</code></p>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded-full text-sm ${statusClasses}">
                ${this.getStatusLabel(tournament.status)}
              </span>
              ${isOwner ? '<span class="text-xs text-gray-400 uppercase tracking-wide">Organizer</span>' : ''}
            </div>
          </header>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <h4 class="text-sm uppercase tracking-wide text-gray-400">Players</h4>
              <p class="text-gray-200">${playersList}</p>
              <p class="text-xs text-gray-500 mt-1">${tournament.players.length} / ${tournament.maxPlayers}</p>
            </div>
            <div>
              <h4 class="text-sm uppercase tracking-wide text-gray-400">Winner</h4>
              <p class="text-gray-200" data-winner="${tournament.id}">${tournament.winnerId ? this.formatPlayer(tournament.winnerId) : 'To be decided'}</p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            ${canJoin ? '<button data-action="join" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">Join</button>' : ''}
            ${canStart ? '<button data-action="start" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">Start</button>' : ''}
            ${activeMatch ? `<a href="./match.html?roomId=${activeMatch.roomId}" data-action="enter-room" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition">Enter room</a>` : ''}
            <button data-action="details" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">Details</button>
          </div>

          <div class="hidden" data-details>
            <h4 class="text-sm uppercase tracking-wide text-gray-400 mb-2">Matches</h4>
            ${matches}
          </div>
        </div>
      `;

      list.appendChild(card);

      void this.loadWinnerName(tournament);

      const joinButton = card.querySelector('[data-action="join"]') as HTMLButtonElement | null;
      joinButton?.addEventListener('click', () => {
        void this.joinTournament(tournament.id, joinButton);
      });

      const startButton = card.querySelector('[data-action="start"]') as HTMLButtonElement | null;
      startButton?.addEventListener('click', () => {
        void this.startTournament(tournament.id, startButton);
      });

      const detailsButton = card.querySelector('[data-action="details"]') as HTMLButtonElement | null;
      const detailsSection = card.querySelector('[data-details]') as HTMLDivElement | null;
      detailsButton?.addEventListener('click', () => {
        if (!detailsSection) return;
        detailsSection.classList.toggle('hidden');
        detailsButton.textContent = detailsSection.classList.contains('hidden') ? 'Details' : 'Hide details';
      });
    }
  }

  private getCurrentMatchForUser(tournament: Tournament): TournamentMatch | null {
    if (!this.currentUser) return null;
    if (tournament.status === 'waiting') return null;

    const uid = this.currentUser.id;
    const isParticipant = tournament.players.includes(uid);
    const isOwner = tournament.ownerId === uid;
    // prefer unfinished matches where the user participates
    const pending = tournament.matches.find((m) =>
      (m.status === 'pending' || m.status === 'playing') && (m.player1Id === uid || m.player2Id === uid)
    );
    if (pending) return pending;

    // fallback: if tournament finished, show the last match the user was in
    const last = tournament.matches.find((m) => m.player1Id === uid || m.player2Id === uid);
    if (last) return last;

    // safety net: if user is a participant (or the organizer) but not mapped to a match, pick the first match
    if ((isParticipant || isOwner) && tournament.matches.length > 0) {
      return tournament.matches[0];
    }

    return null;
  }

  private renderMatches(matches: TournamentMatch[]): string {
    if (!matches || matches.length === 0) {
      return '<p class="text-gray-400">Matches will be generated when the tournament starts.</p>';
    }

    const items = matches.map((match) => {
      const matchLabel = match.isFinal ? 'Final' : 'Match';
      const players = [
        match.player1Id ? this.formatPlayer(match.player1Id) : 'TBD',
        match.player2Id ? this.formatPlayer(match.player2Id) : 'TBD',
      ].join(' vs ');
      const status = this.getMatchStatusLabel(match.status);
      const winner = match.winnerId ? `Winner: ${this.formatPlayer(match.winnerId)}` : '';

      return `
        <li class="border border-gray-700 rounded-lg p-3 bg-gray-900">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-semibold text-gray-200">${matchLabel}</span>
            <span class="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300 uppercase tracking-wide">${status}</span>
          </div>
          <p class="text-sm text-gray-300 mt-1">${players}</p>
          <p class="text-xs text-gray-500 mt-2">Room: <code>${match.roomId}</code></p>
          ${winner ? `<p class="text-sm text-green-400 mt-2">${winner}</p>` : ''}
        </li>
      `;
    });

    return `<ul class="space-y-3">${items.join('')}</ul>`;
  }

  private formatPlayer(userId: string | null): string {
    return this.getDisplayNameSync(userId);
  }

  private getDisplayNameSync(userId: string | null): string {
    if (!userId) return 'TBD';
    if (this.currentUser && userId === this.currentUser.id) {
      return `${this.currentUser.username} (you)`;
    }
    const cached = this.nameCache.get(userId);
    return cached ?? userId;
  }

  private async loadWinnerName(tournament: Tournament): Promise<void> {
    const winnerId = tournament.winnerId;
    if (!winnerId || this.nameCache.has(winnerId) || this.fetchingNames.has(winnerId)) return;
    if (!this.accessToken) return;

    this.fetchingNames.add(winnerId);
    try {
      const profile = await this.fetchUserProfile(winnerId);
      const display = profile?.name || profile?.username || profile?.id || winnerId;
      this.nameCache.set(winnerId, display);

      // update winner text in place if still in DOM
      const el = document.querySelector(`[data-winner="${tournament.id}"]`);
      if (el) {
        el.textContent = display;
      }
    } catch (err) {
      console.warn('Failed to fetch winner name', winnerId, err);
    } finally {
      this.fetchingNames.delete(winnerId);
    }
  }

  private async fetchUserProfile(userId: string): Promise<{ name?: string; username?: string; id?: string } | null> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch(`/api/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data as any).profile ?? null;
    } catch (err) {
      return null;
    }
  }

  private getTournamentName(tournament: Tournament): string {
    if (tournament.name && tournament.name.trim().length > 0) {
      return tournament.name;
    }
    return 'Untitled tournament';
  }

  private getStatusLabel(status: Tournament['status']): string {
    switch (status) {
      case 'waiting':
        return 'Waiting for players';
      case 'running':
        return 'In progress';
      case 'finished':
        return 'Finished';
      default:
        return status;
    }
  }

  private getStatusClasses(status: Tournament['status']): string {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-900/60 text-yellow-300 border border-yellow-700';
      case 'running':
        return 'bg-blue-900/60 text-blue-200 border border-blue-700';
      case 'finished':
        return 'bg-green-900/60 text-green-200 border border-green-700';
      default:
        return 'bg-gray-800 text-gray-300 border border-gray-700';
    }
  }

  private getMatchStatusLabel(status: TournamentMatch['status']): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'playing':
        return 'In progress';
      case 'finished':
        return 'Finished';
      default:
        return status;
    }
  }

  private async createTournament(): Promise<void> {
    if (!this.accessToken) return;

    const nameInput = document.getElementById('tournamentName') as HTMLInputElement | null;
    const sizeSelect = document.getElementById('tournamentSize') as HTMLSelectElement | null;

    const rawName = nameInput?.value.trim() ?? '';
    const rawSize = Number(sizeSelect?.value ?? 4);
    const maxPlayers = rawSize === 2 || rawSize === 4 ? rawSize : 4;

    const payload: { name?: string; maxPlayers: number } = { maxPlayers };
    if (rawName.length > 0) {
      payload.name = rawName;
    }

    try {
      const response = await fetch('/api/realtime/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to create tournament');
      }

      const createdTournament: Tournament | null = data?.tournament ?? null;

      nameInput?.value && (nameInput.value = '');
      this.showMessage('Tournament created successfully!', 'success');

      if (createdTournament?.id && createdTournament.maxPlayers === 2) {
        const started = await this.startTournament(createdTournament.id, null, {
          redirectAfterStart: true,
          skipMessage: true,
        });
        if (started) return;
      }

      await this.loadTournaments();
    } catch (error) {
      console.error('createTournament error:', error);
      this.showMessage((error as Error).message ?? 'Error creating tournament.', 'error');
    }
  }

  private async joinTournament(tournamentId: string, button?: HTMLButtonElement): Promise<void> {
    if (!this.accessToken) return;

    if (button) {
      button.disabled = true;
      button.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
      const response = await fetch(`/api/realtime/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to join the tournament');
      }

      const joinedTournament: Tournament | null = data?.tournament ?? null;

      this.showMessage('Registration confirmed!', 'success');

      if (joinedTournament && joinedTournament.status === 'running' && joinedTournament.maxPlayers === 2) {
        await this.redirectToMatch(joinedTournament);
      }

      await this.loadTournaments();
    } catch (error) {
      console.error('joinTournament error:', error);
      this.showMessage((error as Error).message ?? 'Error joining tournament.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  private async startTournament(
    tournamentId: string,
    button?: HTMLButtonElement | null,
    options?: { redirectAfterStart?: boolean; skipMessage?: boolean },
  ): Promise<Tournament | null> {
    if (!this.accessToken) return null;

    if (button) {
      button.disabled = true;
      button.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
      const response = await fetch(`/api/realtime/tournaments/${tournamentId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to start the tournament');
      }

      const tournament: Tournament | null = data?.tournament ?? null;

      if (!options?.skipMessage) {
        this.showMessage('Tournament started!', 'success');
      }

      if (options?.redirectAfterStart && tournament) {
        await this.redirectToMatch(tournament);
      }

      await this.loadTournaments();
      return tournament;
    } catch (error) {
      console.error('startTournament error:', error);
      this.showMessage((error as Error).message ?? 'Error starting tournament.', 'error');
      return null;
    } finally {
      if (button) {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  private async fetchTournament(tournamentId: string): Promise<Tournament | null> {
    if (!this.accessToken) return null;

    try {
      const res = await fetch(`/api/realtime/tournaments/${tournamentId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return (data?.tournament as Tournament) ?? null;
    } catch (err) {
      console.warn('fetchTournament failed', err);
      return null;
    }
  }

  private async redirectToMatch(tournament: Tournament | string): Promise<void> {
    const resolved = typeof tournament === 'string' ? await this.fetchTournament(tournament) : tournament;
    if (!resolved) return;
    const match = this.getCurrentMatchForUser(resolved);
    if (match) {
      window.location.href = `./match.html?roomId=${match.roomId}`;
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = './login.html';
    }
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
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
}

document.addEventListener('DOMContentLoaded', () => {
  new TournamentsPage();
});
