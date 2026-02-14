![alt text](<UI SS/LocalReactUIOpenEMR.png>)

![alt text](<UI SS/OpenEMRUI.png>)

# OpenEMR Integration Demo

A containerized healthcare integration system demonstrating OAuth2-secured integration with OpenEMR using Node.js and React.

## Architecture

React (Frontend) → Node.js (API Proxy) → OpenEMR (Docker) → MariaDB

## Features

- OAuth2 authentication with scope-based access
- Automatic token acquisition and refresh
- Patient listing and creation
- Containerized OpenEMR + MariaDB
- Full-stack integration workflow

## Tech Stack

- Docker / Docker Compose
- OpenEMR
- MariaDB
- Node.js (Express)
- React + TypeScript
- OAuth2
- FHIR & REST APIs

## Run From GitHub

### 1) Clone and enter the project

```bash
git clone <your-repo-url>
cd openemr-demo
```

### 2) Start OpenEMR + MariaDB (Using Docker Engine)

```bash
cd docker
docker compose up -d
cd ..
```

OpenEMR will be available at:
- `http://localhost:8300`

### 3) Configure API environment

Create `api/.env` from the example:

```bash
cp api/.env.example api/.env
```

Then set real values in `api/.env`:
- `OPENEMR_BASE`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `USERNAME`
- `PASSWORD`
- Optional: `USER_ROLE`, `OPENEMR_TOKEN_SCOPE`, `CORS_ORIGINS`

### 4) Install dependencies

```bash
cd api && npm install && cd ..
cd web && npm install && cd ..
```

### 5) Start API and Web

Terminal 1:

```bash
cd api
npm run dev
```

Terminal 2:

```bash
cd web
npm run dev
```

### 6) Open the app

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

## Notes

- If the frontend build complains about Node version, use Node `20.19+` or `22.12+`.
- Keep `api/.env` out of Git. Commit only `api/.env.example`.
