# EventBoard Monolith API

A NestJS-based backend API for EventBoard - an event management platform.

## Prerequisites

- Node.js >= 18
- npm >= 9

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode (with hot reload)
npm run start:dev
```

The API will be available at `http://localhost:3000`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start the application |
| `npm run start:dev` | Start in watch mode (development) |
| `npm run start:debug` | Start in debug mode with watch |
| `npm run start:prod` | Start in production mode |
| `npm run build` | Build the application |
| `npm run lint` | Run ESLint and fix issues |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run end-to-end tests |

## Health Check

Verify the API is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-26T00:00:00.000Z",
  "service": "EventBoard API"
}
```

## Project Structure

```
src/
├── main.ts              # Application entry point
├── app.module.ts        # Root module
├── app.controller.ts    # Root controller (health endpoint)
├── config/              # Configuration files
├── common/              # Cross-cutting concerns
│   ├── decorators/      # Custom decorators
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Request/response interceptors
│   └── pipes/           # Validation pipes
└── modules/             # Feature modules
    ├── auth/            # Authentication & authorization
    ├── events/          # Event management
    ├── moderation/      # Content moderation
    ├── orgs/            # Organization management
    └── users/           # User management
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |

## License

UNLICENSED - Private repository
