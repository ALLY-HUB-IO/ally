FROM node:20-slim

# Install OpenSSL and other dependencies for Prisma compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY services/admin-service/package*.json ./
COPY services/admin-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY services/admin-service/src/ ./src/

# Copy Prisma schema
COPY packages/db/prisma ./prisma

# Build the application
RUN npm run build

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8083/health || exit 1

# Start the application
CMD ["npm", "start"]
