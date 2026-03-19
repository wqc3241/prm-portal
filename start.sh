#!/bin/sh
set -e

echo "[Startup] Running migrations..."
npx knex migrate:latest --knexfile knexfile.production.js
echo "[Startup] Migrations complete."

echo "[Startup] Running seeds..."
npx knex seed:run --knexfile knexfile.production.js || echo "[Startup] Seeds failed (may already exist), continuing..."
echo "[Startup] Seeds complete."

echo "[Startup] Starting server on port ${PORT:-3000}..."
exec node dist/server.js
