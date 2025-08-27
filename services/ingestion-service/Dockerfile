FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY services/ingestion-service/package.json ./services/ingestion-service/
COPY packages/platform-adapters/discord/package.json ./packages/platform-adapters/discord/
COPY packages/events/package.json ./packages/events/

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY services/ingestion-service/src ./services/ingestion-service/src
COPY packages/platform-adapters/discord/src ./packages/platform-adapters/discord/src
COPY packages/events/src ./packages/events/src
COPY packages/platform-adapters/discord/tsconfig.json ./packages/platform-adapters/discord/
COPY packages/events/tsconfig.json ./packages/events/
COPY services/ingestion-service/tsconfig.json ./services/ingestion-service/

# Build packages
RUN yarn workspace @ally/events build
RUN yarn workspace @ally/platform-adapter-discord build
RUN yarn workspace ingestion-service build

# Set working directory to ingestion service
WORKDIR /app/services/ingestion-service

# Start the service
CMD ["node", "dist/index.js"]
