# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/ ./packages/
COPY services/shade-agent/package.json ./services/shade-agent/
RUN yarn install --frozen-lockfile --production

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock* ./
COPY packages/ ./packages/
COPY services/shade-agent/package.json services/shade-agent/tsconfig.json ./services/shade-agent/
RUN yarn install --frozen-lockfile
COPY services/shade-agent/src/ ./services/shade-agent/src/
WORKDIR /app/services/shade-agent
RUN yarn build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=builder /app/services/shade-agent/dist ./dist
COPY services/shade-agent/package.json ./
COPY infra/supported.json ./infra/
CMD ["yarn", "start"]