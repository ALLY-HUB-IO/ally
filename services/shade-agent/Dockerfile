# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --production

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock* tsconfig.json ./
RUN yarn install --frozen-lockfile
COPY src/ ./src/
RUN yarn build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
CMD ["yarn", "start"]