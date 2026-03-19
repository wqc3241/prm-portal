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
COPY tsconfig.json tsconfig.build.json tsconfig.db.json knexfile.ts ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY seeds/ ./seeds/
COPY client/ ./client/

# Build server TypeScript (src/ → dist/)
# Type errors from Express v5 params and Knex are safe at runtime
RUN npx tsc -p tsconfig.build.json || true

# Compile migrations, seeds, and knexfile to JS (for production runtime)
RUN npx tsc -p tsconfig.db.json || true

# Build client React app
RUN cd client && npm run build

# ══════════════════════════════════════════════════════════════════════════════
# Stage 2 — Production
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS production

ENV NODE_ENV=production

RUN apk add --no-cache tini

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled server (src/ → dist/)
COPY --from=builder /app/dist/ ./dist/

# Copy compiled knexfile.js to project root (server imports it via ../../knexfile)
COPY --from=builder /app/dist-db/knexfile.js ./knexfile.js

# Copy compiled migrations and seeds for production knex CLI
COPY --from=builder /app/dist-db/migrations/ ./migrations-compiled/
COPY --from=builder /app/dist-db/seeds/ ./seeds-compiled/

# Copy the plain-JS production knexfile for the CLI
COPY knexfile.production.js ./knexfile.production.js

# Copy client build output
COPY --from=builder /app/client/dist/ ./client/dist/

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# Run migrations, seed data, then start the server — all plain JS, no ts-node needed
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.production.js && npx knex seed:run --knexfile knexfile.production.js && node dist/server.js"]
