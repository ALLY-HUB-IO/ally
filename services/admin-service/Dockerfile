FROM node:20-slim

# Install OpenSSL and other dependencies for Prisma compatibility
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace files
COPY package.json yarn.lock* ./
COPY packages/ ./packages/

# Copy admin-service specific files
COPY services/admin-service/package*.json ./services/admin-service/
COPY services/admin-service/tsconfig.json ./services/admin-service/

# Install dependencies using yarn (to work with workspace)
RUN yarn install --frozen-lockfile

# Copy source code
COPY services/admin-service/src/ ./services/admin-service/src/

# Copy Prisma schema
COPY packages/db/prisma ./prisma

# Copy config file
COPY infra/supported.json ./infra/

# Build the application
WORKDIR /app/services/admin-service
RUN yarn build

# Generate Prisma client
RUN npx prisma generate --schema=../../prisma/schema.prisma

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8083/health || exit 1

# Start the application
CMD ["yarn", "start"]
