_This project has been created as part of the 42 curriculum by luguimar, ecorona-, mfaria-p, pevieira._

# ft_transcendence

## Description

**Project name:** ft_transcendence

**Goal:** Build a full‑stack, real‑time Pong platform for 42 that combines secure authentication, social features, and multiplayer gameplay. The project demonstrates a microservice backend with WebSockets and a modern frontend UI, delivering a responsive experience across devices.

**Overview:** The project is organized as a microservice backend (gateway, auth, user, realtime/ws) behind an Nginx reverse proxy, with a static TypeScript/Tailwind frontend. Services communicate over HTTP/WebSocket within Docker Compose networks.

**Key features (summary):**

- API gateway with service routing and rate limiting
- Auth service with JWT + Google OAuth
- User/profile service with social graph (requests/friendships)
- Realtime WebSocket service for presence/game updates

## Instructions

**Prerequisites:**

- Docker + Docker Compose
- (Optional local dev) Node.js + pnpm (monorepo uses pnpm workspaces)
- Environment variables: `JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`

**Setup & Run (step‑by‑step):**

1. Create a `.env` file with required secrets (`JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`).
2. Development: `docker compose -f srcs/docker-compose.dev.yml up --build`
3. Production: `docker compose -f srcs/docker-compose.yml up --build`
4. Access the app via Nginx on `https://localhost:9000` (prod) or `http://localhost:9000` (dev).

**Build / Test (optional):**

- Backend tests: `pnpm -C srcs/backend test`
- Frontend build: `pnpm -C srcs/frontend build`

## Team Information

- **luguimar** — **Role(s):** [PO/Dev]
  - **Responsibilities:** Backend development and service integration.
- **ecorona-** — **Role(s):** [Tech Lead/Dev]
  - **Responsibilities:** Backend architecture and core service development.
- **mfaria-p** — **Role(s):** [PM/Dev]
  - **Responsibilities:** Frontend development and feature implementation.
- **pevieira** — **Role(s):** [Dev]
  - **Responsibilities:** Frontend development; UI style and animations.

## Project Management

- **Organization:** Weekly planning meetings (1x per week) to align tasks and track progress.
- **Tools:** GitHub (issues, branching).
- **Communication:** Google Meet for meetings; WhatsApp for day‑to‑day communication.

## Technical Stack

**Frontend:**

- Static HTML + TypeScript, CSS + Tailwind (`@tailwindcss/cli`)
- Lottie animations (web player)
- Build pipeline via `tsc` + Tailwind CLI

**Backend:**

- Fastify services (`auth`, `user`, `gateway`, `ws`)
- JWT auth (`@fastify/jwt`), cookies, CORS, rate limiting
- WebSockets via `@fastify/websocket`
- Prisma ORM (`@prisma/client`) with generated clients

**Database:**

- SQLite (separate DBs for auth and user services)
- Managed by Prisma migrations

**Other significant technologies:**

- Nginx reverse proxy
- Docker Compose orchestration
- pnpm workspaces (backend packages)

## Database Schema

**Overview:** Two SQLite databases managed by Prisma: one for `auth` and one for `user/profile`.

**Entities & Relationships:**

- **Account** (auth DB): `id`, `username`, `email`, `passwordHash`, `emailVerified`, timestamps
- **OAuthAccount** (auth DB): provider (`google`), `providerAccountId`, `accountId` (1:1 with Account)
- **RefreshToken** (auth DB): `tokenHash`, `expiresAt`, `revokedAt`, `accountId` (N:1 to Account)
- **Profile** (user DB): `id`, `avatarUrl`, timestamps
- **FriendRequest** (user DB): `fromProfileId`, `toProfileId`, `status`, `message`, timestamps
- **Friendship** (user DB): `profileAId`, `profileBId`, `createdAt` (unique pair)

## Features List

- **Auth + JWT sessions** — **Owner:** ecorona-
  - **Description:** Secure login/session handling with token verification and refresh logic.
- **Google OAuth login** — **Owner:** ecorona-
  - **Description:** Remote authentication via Google OAuth provider.
- **Profiles + social graph** — **Owner:** ecorona-, mfaria-p
  - **Description:** User profiles, friend requests, and friendships with Prisma models.
- **API gateway** — **Owner:** luguimar
  - **Description:** Central routing to auth/user/ws services with CORS and rate limiting.
- **WebSockets realtime** — **Owner:** luguimar
  - **Description:** Presence and live game updates via `@fastify/websocket`.
- **Pong game (web)** — **Owner:** mfaria-p, pevieira
  - **Description:** HTML5 canvas Pong gameplay with scoring and controls.
- **AI opponent** — **Owner:** ecorona-
  - **Description:** Client‑side AI paddle with human‑like reaction behavior.
- **Remote play flow** — **Owner:** luguimar, pevieira
  - **Description:** Real‑time match flow between remote clients via WebSockets.
- **Frontend UI & animations** — **Owner:** pevieira, mfaria-p
  - **Description:** UI styling, layout, and Lottie animations across pages.

## Modules (ft_transcendence Surprise)

**Chosen modules and points:**

- **Major (2 pts):** WebSockets — **Owner:** luguimar
  - **Justification:** Real‑time gameplay and presence require bidirectional communication.
  - **Implementation:** `@fastify/websocket` service (`ws`) behind gateway.
- **Major (2 pts):** User Management — **Owner:** ecorona-, mfaria-p
  - **Justification:** Accounts, profiles, and social features are core to the platform.
  - **Implementation:** `auth` + `user` services with Prisma + SQLite.
- **Major (2 pts):** AI Opponent — **Owner:** ecorona-
  - **Justification:** Enables solo gameplay with a challenging, human‑like bot.
  - **Implementation:** Client‑side AI logic in the Pong game.
- **Major (2 pts):** Web‑based Game (Pong) — **Owner:** mfaria-p, pevieira
  - **Justification:** Core gameplay module.
  - **Implementation:** HTML5 canvas Pong with real‑time updates.
- **Major (2 pts):** Remote Players — **Owner:** luguimar, pevieira
  - **Justification:** Supports real‑time matches between separate clients.
  - **Implementation:** WebSocket messaging and session handling.
- **Major (2 pts):** Microservices — **Owner:** ecorona-, luguimar
  - **Justification:** Clear separation of responsibilities and scalability.
  - **Implementation:** Gateway, auth, user, and ws services in Docker Compose.

- **Minor (1 pt):** Framework (Backend) — **Owner:** luguimar, ecorona-
  - **Justification:** Structured backend development with a web framework.
  - **Implementation:** Fastify + Node.js + TypeScript.
- **Minor (1 pt):** Database ORM — **Owner:** ecorona-
  - **Justification:** Schema‑driven DB access with migrations.
  - **Implementation:** Prisma + SQLite.
- **Minor (1 pt):** Remote Auth (OAuth) — **Owner:** ecorona-
  - **Justification:** Easier sign‑in and improved UX.
  - **Implementation:** Google OAuth flow in `auth` service.
- **Minor (1 pt):** Tournaments — **Owner:** pevieira, luguimar
  - **Justification:** Extends gameplay with competitive brackets.
  - **Implementation:** Users create public or private tournaments (2 or 4 players), join via list or invite code, and the UI tracks status (waiting/running/finished). When full, the organizer can start (auto-start for 2‑player), matches are generated, and players are redirected to the correct match room; history shows recent winners and finished brackets.

**Point total:** 16 points (6 Majors + 4 Minors)

## Individual Contributions

- **luguimar**: Backend development and service integration; led WebSockets module implementation and helped define microservice boundaries and remote play messaging.
- **ecorona-**: Backend architecture and core services; implemented user management, AI opponent logic, and OAuth flow with Prisma integration.
- **mfaria-p**: Frontend feature implementation and UI integration; co-built the Pong game experience and worked on user management flows from the frontend.
- **pevieira**: Frontend development with focus on UI style and animations; co-built the Pong game UI and collaborated on remote play and tournament-facing screens.

## Resources

**Classic references:**

- LiChess.org
- Ponggame.org
- Fastify documentation
- Prisma documentation
- Tailwind CSS documentation

**AI usage:**

- **Where used:** UI copy refinement, small code adjustments, and documentation drafting.
- **How used:** Brainstorming, summarization, and incremental edits reviewed by the team.
- **Which parts:** Minor bug fixing suggestions, refactoring ideas, and documentation text only. No core logic or project architecture was generated automatically.

Isto protege-vos numa defesa oral.

## Known Limitations

- WebSocket stability may vary on older browsers without full support.
- Performance can degrade on low‑end devices when many matches/presence events are active.
- Tournament flow and statistics are minimal and can be expanded.

## License

- Educational project (no commercial license specified).
