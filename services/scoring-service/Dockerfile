# syntax=docker/dockerfile:1

FROM node:22-slim

WORKDIR /app

# 1) Leverage install layer caching
COPY package.json yarn.lock ./
COPY packages ./packages
COPY services/scoring-service/package.json ./services/scoring-service/package.json
RUN corepack enable && corepack prepare yarn@1.22.22 --activate && yarn install --frozen-lockfile

# 2) Copy the rest & build
COPY . .
RUN yarn workspace @ally/intelligence-edgecloud build && \
    yarn workspace scoring-service build

ENV NODE_ENV=production
EXPOSE 8081
CMD ["node", "services/scoring-service/dist/index.js"]


