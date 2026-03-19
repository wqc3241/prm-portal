# ══════════════════════════════════════════════════════════════════════════════
# Stage 1 — Build
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# Force development mode so npm installs devDependencies (TypeScript, @types/*)
ENV NODE_ENV=development

# Install server dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Install client dependencies
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci

# Copy source files
COPY tsconfig.json tsconfig.build.json knexfile.ts ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY seeds/ ./seeds/
COPY client/ ./client/

# Build server TypeScript (use relaxed tsconfig — strict checks run in CI, not in Docker build)
RUN npx tsc -p tsconfig.build.json

# Build client React app
RUN cd client && npm run build

# ══════════════════════════════════════════════════════════════════════════════
# Stage 2 — Production
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS production

RUN apk add --no-cache tini

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled server
COPY --from=builder /app/dist/ ./dist/

# Copy client build output (served as static files)
COPY --from=builder /app/client/dist/ ./client/dist/

# Copy migration, seed, and config files (needed at runtime for knex)
COPY --from=builder /app/knexfile.ts ./knexfile.ts
COPY --from=builder /app/migrations/ ./migrations/
COPY --from=builder /app/seeds/ ./seeds/
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# ts-node is needed for knex CLI to run .ts migrations/seeds
RUN npm install --no-save ts-node typescript @types/node

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# Entrypoint: run migrations, seed base data, seed demo data, start server
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.ts && npx knex seed:run --knexfile knexfile.ts && node dist/server.js"]
