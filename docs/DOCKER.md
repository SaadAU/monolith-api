# Docker Configuration Guide

## Overview

This document explains the Docker containerization setup for the EventBoard API, including PostgreSQL database and NestJS application orchestration using Docker Compose.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Compose Setup                          │
│                                                                  │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   PostgreSQL     │              │   NestJS API     │        │
│  │   Container      │◄─────────────│   Container      │        │
│  │                  │   Network    │                  │        │
│  │  postgres:16     │              │  node:20-alpine  │        │
│  │  Port: 5432      │              │  Port: 3000      │        │
│  └──────────────────┘              └──────────────────┘        │
│         │                                    │                  │
│         │                                    │                  │
│         ▼                                    ▼                  │
│  postgres_data                         Source Code              │
│  (persistent)                          (bind mount)             │
│                                                                  │
│                    app-network (bridge)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Files

### 1. Dockerfile
**Location:** `Dockerfile`

```dockerfile
# Development Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start in development mode with hot-reload
CMD ["npm", "run", "start:dev"]
```

**Key Features:**
- **Base Image:** `node:20-alpine` (lightweight, production-grade)
- **Working Directory:** `/app`
- **Dependency Installation:** Caches npm packages for faster rebuilds
- **Hot-Reload:** Uses `npm run start:dev` for development
- **Port:** Exposes port 3000

### 2. docker-compose.yml
**Location:** `docker-compose.yml`

Full configuration with two services: PostgreSQL and NestJS API.

## Service Configuration

### PostgreSQL Service

```yaml
postgres:
  image: postgres:16
  container_name: postgres_db
  restart: always
  environment:
    POSTGRES_USER: admin
    POSTGRES_PASSWORD: admin123
    POSTGRES_DB: mydb
  ports:
    - "5433:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - app-network
```

#### Configuration Details

| Setting | Value | Description |
|---------|-------|-------------|
| **Image** | `postgres:16` | Official PostgreSQL 16 image |
| **Container Name** | `postgres_db` | Easy identification in Docker |
| **Restart Policy** | `always` | Auto-restart on failure |
| **User** | `admin` | Database superuser |
| **Password** | `admin123` | ⚠️ Change in production |
| **Database** | `mydb` | Default database created on startup |
| **Host Port** | `5433` | External port (avoids conflict with local Postgres) |
| **Container Port** | `5432` | Internal PostgreSQL port |
| **Volume** | `postgres_data` | Persistent data storage |
| **Network** | `app-network` | Shared network with API |

#### Why Port 5433?
- **Port 5433 on host** → **Port 5432 in container**
- Avoids conflict if you have PostgreSQL installed locally (which uses 5432)
- API connects to `postgres:5432` (internal network)
- External tools connect to `localhost:5433`

### NestJS API Service

```yaml
api:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: nestjs_api
  restart: always
  ports:
    - "3000:3000"
  environment:
    - NODE_ENV=development
    - DB_HOST=postgres
    - DB_PORT=5432
    - DB_USERNAME=admin
    - DB_PASSWORD=admin123
    - DB_DATABASE=mydb
  volumes:
    - .:/app
    - /app/node_modules
  depends_on:
    - postgres
  networks:
    - app-network
```

#### Configuration Details

| Setting | Value | Description |
|---------|-------|-------------|
| **Build Context** | `.` | Current directory |
| **Dockerfile** | `Dockerfile` | Build instructions |
| **Container Name** | `nestjs_api` | Easy identification |
| **Restart Policy** | `always` | Auto-restart on failure |
| **Port** | `3000:3000` | API accessible at localhost:3000 |
| **NODE_ENV** | `development` | Enables dev features, verbose logging |
| **DB_HOST** | `postgres` | Container name (internal DNS) |
| **DB_PORT** | `5432` | Internal PostgreSQL port |
| **Volumes** | Source code bind mount | Hot-reload on file changes |
| **Depends On** | `postgres` | Start DB before API |
| **Network** | `app-network` | Shared network with Postgres |

#### Volume Configuration

```yaml
volumes:
  - .:/app                # Bind mount source code for hot-reload
  - /app/node_modules     # Preserve node_modules from container
```

**Why two volumes?**
1. **`.:/app`**: Syncs source code for hot-reload during development
2. **`/app/node_modules`**: Prevents host `node_modules` from overwriting container's (platform-specific binaries)

### Network Configuration

```yaml
networks:
  app-network:
    driver: bridge
```

- **Type:** Bridge network (default Docker network type)
- **Purpose:** Allows containers to communicate using service names
- **DNS:** Automatic service discovery (e.g., `postgres` resolves to Postgres container IP)

### Volume Configuration

```yaml
volumes:
  postgres_data:
```

- **Named Volume:** `postgres_data`
- **Purpose:** Persists PostgreSQL data across container restarts
- **Location:** Managed by Docker (typically `/var/lib/docker/volumes/`)
- **Data Survives:** `docker compose down` (but not `docker compose down -v`)

## Environment Variables

### API Container Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `development` | Enables dev mode, verbose logs |
| `DB_HOST` | `postgres` | Database host (service name) |
| `DB_PORT` | `5432` | Database port (internal) |
| `DB_USERNAME` | `admin` | Database user |
| `DB_PASSWORD` | `admin123` | Database password |
| `DB_DATABASE` | `mydb` | Database name |

**Note:** These override values in `.env` file when running in Docker.

## Usage Guide

### Starting Services

```bash
# Start all services in detached mode
docker compose up -d

# Start with build (if Dockerfile changed)
docker compose up -d --build

# Start and view logs
docker compose up
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail=100 api
```

### Stopping Services

```bash
# Stop services (keeps containers)
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (⚠️ deletes data)
docker compose down -v
```

### Restarting Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart api
```

### Rebuilding After Code Changes

```bash
# Rebuild and restart API
docker compose up -d --build api

# Rebuild everything
docker compose up -d --build
```

### Accessing Containers

```bash
# Execute command in running container
docker compose exec api sh
docker compose exec postgres psql -U admin -d mydb

# Run one-off command
docker compose run --rm api npm run test
```

### Database Access

#### From Host Machine

```bash
# Using psql (if installed)
psql -h localhost -p 5433 -U admin -d mydb

# Using Docker
docker compose exec postgres psql -U admin -d mydb
```

#### From API Container

```bash
# Already configured via environment variables
# API connects to: postgres:5432
```

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd monolith-api

# 2. Create .env file (optional, Docker uses docker-compose.yml env vars)
cp .env.example .env

# 3. Start services
docker compose up -d

# 4. Check logs
docker compose logs -f api

# 5. Access API
curl http://localhost:3000
```

### Making Code Changes

1. **Edit files** in your editor
2. **Hot-reload** automatically updates container
3. **Check logs**: `docker compose logs -f api`
4. **Test**: `curl http://localhost:3000/...`

### Running Database Migrations

```bash
# Run migration inside container
docker compose exec api npm run migration:run

# Or generate migration
docker compose exec api npm run migration:generate -- -n MigrationName
```

### Running Tests

```bash
# Unit tests
docker compose exec api npm run test

# E2E tests
docker compose exec api npm run test:e2e

# Coverage
docker compose exec api npm run test:cov
```

## Troubleshooting

### API Can't Connect to Database

**Symptoms:**
```
Error: connect ECONNREFUSED postgres:5432
```

**Solutions:**
1. **Check Postgres is running:**
   ```bash
   docker compose ps
   ```

2. **Check network:**
   ```bash
   docker network inspect monolith-api_app-network
   ```

3. **Check environment variables:**
   ```bash
   docker compose exec api env | grep DB_
   ```

4. **Restart services:**
   ```bash
   docker compose restart
   ```

### Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
```

**Solutions:**
1. **Change host port in docker-compose.yml:**
   ```yaml
   ports:
     - "3001:3000"  # Use 3001 instead of 3000
   ```

2. **Stop conflicting service:**
   ```bash
   # Find process using port
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000                  # Mac/Linux
   
   # Kill process
   taskkill /PID <pid> /F         # Windows
   kill -9 <pid>                   # Mac/Linux
   ```

### Hot-Reload Not Working

**Solutions:**
1. **Check volume mount:**
   ```bash
   docker compose exec api ls -la /app
   ```

2. **Restart container:**
   ```bash
   docker compose restart api
   ```

3. **Rebuild:**
   ```bash
   docker compose up -d --build api
   ```

### Database Data Lost

**Cause:** Used `docker compose down -v` (removes volumes)

**Prevention:**
```bash
# Use this to keep data:
docker compose down

# Only use this to reset everything:
docker compose down -v
```

**Recovery:**
- Data is lost if volume was removed
- Re-run migrations/seeds

### Node Modules Issues

**Symptoms:**
```
Error: Cannot find module 'xyz'
```

**Solutions:**
1. **Rebuild container:**
   ```bash
   docker compose down
   docker compose up -d --build
   ```

2. **Clear node_modules:**
   ```bash
   docker compose run --rm api rm -rf node_modules
   docker compose up -d --build
   ```

## Performance Optimization

### 1. Layer Caching

Dockerfile already optimized:
```dockerfile
# Copy package files first (changes less frequently)
COPY package*.json ./
RUN npm install

# Copy source code last (changes frequently)
COPY . .
```

### 2. Volume Performance (Windows/Mac)

For better I/O performance on Windows/Mac:
```yaml
volumes:
  - .:/app:cached  # Cached mode for better performance
```

### 3. Development vs Production

**Development (current):**
- Hot-reload enabled
- Source code mounted
- Verbose logging

**Production (recommended):**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

## Security Considerations

### Current Setup (Development)

⚠️ **Not suitable for production:**
- Hardcoded credentials
- Root user in containers
- No secrets management
- Debug mode enabled

### Production Recommendations

1. **Use Environment Files:**
   ```bash
   docker compose --env-file .env.production up -d
   ```

2. **Use Docker Secrets:**
   ```yaml
   secrets:
     db_password:
       file: ./secrets/db_password.txt
   
   services:
     postgres:
       secrets:
         - db_password
   ```

3. **Non-Root User:**
   ```dockerfile
   RUN addgroup -g 1001 -S nodejs
   RUN adduser -S nestjs -u 1001
   USER nestjs
   ```

4. **Scan Images:**
   ```bash
   docker scan nestjs_api
   ```

## Monitoring

### Container Stats

```bash
# Real-time stats
docker stats

# Specific container
docker stats nestjs_api postgres_db
```

### Health Checks

Add to docker-compose.yml:
```yaml
api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Logging

```bash
# Configure logging driver
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## CI/CD Integration

Docker is used in GitHub Actions CI pipeline:

```yaml
# .github/workflows/ci.yml uses:
services:
  postgres:
    image: postgres:15-alpine  # Same as local
```

See [CI.md](CI.md) for details.

## Conclusion

This Docker setup provides:
- ✅ **Consistent Environment**: Same setup for all developers
- ✅ **Easy Onboarding**: One command to start
- ✅ **Isolated Services**: Database and API in separate containers
- ✅ **Hot-Reload**: Fast development iteration
- ✅ **Persistent Data**: Database survives restarts
- ✅ **Network Isolation**: Services communicate securely

For production deployment, see production best practices above.
