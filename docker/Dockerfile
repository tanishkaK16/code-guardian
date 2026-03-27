# AI Code Guardian — Production Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/git-integration/package.json packages/git-integration/
COPY packages/supabase/package.json packages/supabase/
COPY apps/web/package.json apps/web/
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Build all packages
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx turbo build --filter=@ai-code-guardian/core --filter=@ai-code-guardian/git-integration --filter=@ai-code-guardian/supabase

# API Server
FROM base AS api
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "packages/git-integration/dist/index.js"]

# Web Dashboard
FROM base AS web
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx turbo build --filter=ai-code-guardian-web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
