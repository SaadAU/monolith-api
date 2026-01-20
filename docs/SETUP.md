# Setup Guide

## Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (v20 or higher)
- **Docker Compose** (v2 or higher)
- **Git**
- **npm** or **yarn**

## Quick Start (One Command)

```bash
docker-compose up
```

This command will:
1. Build all service images (API Gateway, Auth Service, Events Service)
2. Start PostgreSQL database with automatic initialization
3. Run all three services in development mode
4. Expose:
   - API Gateway: http://localhost:3000
   - Auth Service: localhost:3002 (TCP)
   - Events Service: localhost:3001 (TCP)

## Manual Setup (Development)

### 1. Clone Repository

```bash
git clone <repository-url>
cd monolith-api-Day-13
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory (optional - defaults provided in docker-compose):

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin123
DB_DATABASE=mydb
AUTH_SERVICE_HOST=localhost
AUTH_SERVICE_PORT=3002
EVENTS_SERVICE_HOST=localhost
EVENTS_SERVICE_PORT=3001
```

### 4. Database Setup

```bash
# Start PostgreSQL
docker run -d \
  --name postgres_db \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin123 \
  -e POSTGRES_DB=mydb \
  -p 5433:5432 \
  postgres:16

# Seed database (optional)
npm run db:seed
```

### 5. Start Services

In separate terminals:

```bash
# Terminal 1: Build TypeScript
npm run build

# Terminal 2: Start API Gateway
npm run start:gateway

# Terminal 3: Start Auth Service
npm run start:auth

# Terminal 4: Start Events Service
npm run start:events
```

## Docker Compose Services

### postgres
- **Image**: postgres:16
- **Port**: 5433:5432
- **Credentials**: admin / admin123
- **Database**: mydb
- **Health Check**: Automatic (5s interval)

### api-gateway
- **Port**: 3000:3000
- **Depends On**: postgres, auth-service, events-service
- **Auto-restart**: Yes
- **Mode**: Development with hot-reload

### auth-service
- **Port**: 3002:3002
- **Protocol**: TCP (NestJS Microservices)
- **Depends On**: postgres
- **Auto-restart**: Yes

### events-service
- **Port**: 3001:3001
- **Protocol**: TCP (NestJS Microservices)
- **Depends On**: postgres
- **Auto-restart**: Yes

## Common Commands

```bash
# Development
npm run start:dev                 # Watch mode on all services
npm run start:gateway            # Just gateway
npm run start:auth               # Just auth service
npm run start:events             # Just events service

# Building
npm run build                     # Compile TypeScript
npm run lint                      # Run ESLint

# Database
npm run db:seed                   # Populate sample data
npm run db:reset                  # Clear and reseed database

# Testing
npm run test                      # Unit tests
npm run test:e2e                  # End-to-end tests
npm run test:smoke                # Microservices smoke tests

# Docker
docker-compose up                 # Start all services
docker-compose down               # Stop all services
docker-compose logs -f            # View logs
docker-compose restart            # Restart services
```

## Troubleshooting

### Services won't start
1. Check port availability: `netstat -an | grep 3000`
2. Check Docker: `docker ps -a`
3. View logs: `docker-compose logs -f <service-name>`

### Database connection errors
1. Verify PostgreSQL is running: `docker ps | grep postgres`
2. Check credentials in docker-compose.yml
3. Reset: `docker-compose down -v && docker-compose up`

### High memory usage
Run cleanup: `docker system prune -a`

## Port Reference

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| API Gateway | 3000 | HTTP/REST | User-facing API |
| Events Service | 3001 | TCP | Microservice RPC |
| Auth Service | 3002 | TCP | Microservice RPC |
| PostgreSQL | 5433 | TCP | Database |

## Next Steps

- See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [API.md](./API.md) for endpoint documentation
- See [RUNBOOK.md](./RUNBOOK.md) for operations guide
