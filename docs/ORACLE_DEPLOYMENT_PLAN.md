# Oracle Cloud Always Free Backend Deployment Plan

## Context

The frontend is deployed to GitHub Pages, but the backend (.NET 10 API + Workers +
PostgreSQL + Redis) has no hosting yet. Oracle Cloud's Always Free tier (4-core ARM,
24 GB RAM, never billed) was chosen over Fly.io to avoid usage caps.

GitHub Pages serves the frontend over HTTPS, so browsers block any request to a
plain-HTTP backend (mixed-content policy). Since no domain is owned, the plan uses
**sslip.io** — a free wildcard DNS service where a hostname like `{ip-with-dashes}.sslip.io`
automatically resolves to that IP with no signup required. Caddy can issue a real
Let's Encrypt certificate for it because it's a publicly resolvable hostname.

Decisions:
- **Deploy method**: GitHub Actions auto-deploys on push to `main` (SSH into the VM and redeploy)
- **HTTPS**: sslip.io hostname + Caddy automatic TLS
- **Containers**: API and Workers run as separate containers (matches existing project
  structure: `AmbientWeather.Api` is `Microsoft.NET.Sdk.Web`, `AmbientWeather.Workers` is
  `Microsoft.NET.Sdk.Worker` — two distinct hosts already)

No CORS middleware existed in `Program.cs` prior to this work — required since GitHub
Pages and the Oracle backend are different origins.

## Implementation

### 1. Dockerfiles (multi-stage, ARM64-compatible)

**`backend/src/AmbientWeather.Api/Dockerfile`** — build stage `mcr.microsoft.com/dotnet/sdk:10.0`,
runtime `mcr.microsoft.com/dotnet/aspnet:10.0` (both images support `linux/arm64` natively,
matching the Oracle ARM VM). Publishes `AmbientWeather.Api.csproj`, exposes port 8080,
sets `ASPNETCORE_URLS=http://+:8080`.

**`backend/src/AmbientWeather.Workers/Dockerfile`** — same pattern, runtime base
`mcr.microsoft.com/dotnet/runtime:10.0` (no ASP.NET needed, it's a worker host). No exposed port.

### 2. CORS middleware

In `backend/src/AmbientWeather.Api/Program.cs`, a CORS policy named `Frontend` reads its
allowed origin from configuration (`Cors:AllowedOrigin`) rather than hardcoding it.
`app.UseCors("Frontend")` is placed after `UseRouting()` and before `UseAuthorization()`.
The config value is set via the production `.env` to the GitHub Pages origin
(`https://{github-username}.github.io`).

### 3. `docker-compose.prod.yml` (repo root)

Extends the existing local `docker-compose.yml` pattern (PostgreSQL 16-alpine + Redis
7-alpine with named volumes) and adds:
- `api` service — built from the API Dockerfile, env vars from `.env`, depends on `db` +
  `cache` health checks, named volume mounted at the Data Protection key ring path
  (`DataProtection:KeyRingPath=/keys`) so encryption keys survive container recreation
- `workers` service — built from the Workers Dockerfile, same env vars,
  `HistorySync__Enabled=true`
- `caddy` service — `caddy:2-alpine`, mounts `Caddyfile`, exposes 80/443, named volume for
  `caddy_data` (cert storage so Let's Encrypt isn't re-requested on every restart)

### 4. `Caddyfile` (repo root)

```
{sslip-hostname} {
  reverse_proxy api:8080
}
```
Caddy auto-detects the sslip.io hostname as a real domain and requests a Let's Encrypt
cert. WebSocket upgrade (for `/hubs/weather` SignalR) is handled automatically by Caddy's
`reverse_proxy` — no extra config needed.

### 5. `.env.prod.example` (repo root, committed; real `.env` stays VM-only, gitignored)

Documents every required variable with placeholder values: `POSTGRES_PASSWORD`,
`ConnectionStrings__Postgres`, `ConnectionStrings__Redis`, `Authentication__Authority`,
`Authentication__Audience`, `Cors__AllowedOrigin={https-frontend-origin}`,
`UserAgent__Contact`, `AllowedHosts={sslip-hostname}`, `DataProtection__KeyRingPath=/keys`.

### 6. GitHub Actions deploy workflow

**`.github/workflows/deploy-backend.yml`** — triggers on push to `main` when `backend/**`
or compose/Caddy files change. Uses `appleboy/ssh-action` (MIT licensed) to SSH into the
VM with a key stored as a repo secret (`ORACLE_SSH_KEY`, `ORACLE_HOST`, `ORACLE_USER`) and runs:
```bash
cd ~/MyAmbientWeatherDashboard && git pull && docker compose -f docker-compose.prod.yml up --build -d
```

### 7. VM one-time setup (manual, not automated)

- Provision `VM.Standard.A1.Flex` (4 OCPU, 24 GB), Ubuntu 24.04, attach SSH key
- Open ports 22/80/443 in OCI Security List **and** `iptables` (both layers block traffic
  by default on OCI)
- Install Docker + Compose plugin
- `git clone` the repo, create the real `.env` from `.env.prod.example`
- Run EF migrations once via a one-off `docker compose run api dotnet ef database update`
- First manual `docker compose -f docker-compose.prod.yml up --build -d` to verify before
  relying on the Actions workflow

### 8. Frontend wiring

`VITE_API_BASE_URL={https-sslip-hostname}` is set as a GitHub Actions secret consumed by
the existing `pages.yml` workflow so the built frontend points at the new backend.

## Files created/modified

- `backend/src/AmbientWeather.Api/Dockerfile` (new)
- `backend/src/AmbientWeather.Workers/Dockerfile` (new)
- `backend/src/AmbientWeather.Api/Program.cs` (CORS policy added)
- `backend/src/AmbientWeather.Api/appsettings.Production.json` (new)
- `docker-compose.prod.yml` (new, repo root)
- `Caddyfile` (new, repo root)
- `.env.prod.example` (new, repo root)
- `.gitignore` (`.env` excluded)
- `.github/workflows/deploy-backend.yml` (new)
- `.github/workflows/pages.yml` (`VITE_API_BASE_URL` secret reference)
- `README.md` / `docs/DEVELOPMENT_PLAN.md` (deployment documented, sanitized placeholders only)

## Verification

1. `docker compose -f docker-compose.prod.yml config` locally — validates compose syntax
   before pushing
2. On the VM: `docker compose -f docker-compose.prod.yml up --build -d`, then
   `docker compose ps` — all 5 containers (`db`, `cache`, `api`, `workers`, `caddy`) healthy
3. `curl https://{sslip-hostname}/api/health/ready` — expect `200` with `"status":"Healthy"`
4. From a browser at the GitHub Pages URL, confirm a network request to
   `https://{sslip-hostname}/api/...` succeeds (no CORS or mixed-content errors in console)
5. Confirm SignalR connects: check browser Network tab for a successful
   `/hubs/weather/negotiate` followed by a WebSocket upgrade
6. Push a trivial backend change to `main`, confirm `deploy-backend.yml` runs and the VM
   picks it up (`docker compose ps` shows new container start times)
