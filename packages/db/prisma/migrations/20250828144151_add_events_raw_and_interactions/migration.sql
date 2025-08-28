-- CreateTable
CREATE TABLE "EventsRaw" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "source" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventsRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interactions" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventsRaw_idempotencyKey_key" ON "EventsRaw"("idempotencyKey");

-- CreateIndex
CREATE INDEX "idx_events_raw_project_platform" ON "EventsRaw"("projectId", "platform");

-- CreateIndex
CREATE INDEX "idx_events_raw_type_ts" ON "EventsRaw"("type", "ts");

-- CreateIndex
CREATE INDEX "idx_events_raw_project_ts" ON "EventsRaw"("projectId", "ts");

-- CreateIndex
CREATE INDEX "idx_interactions_project_author" ON "Interactions"("projectId", "authorId");

-- CreateIndex
CREATE INDEX "idx_interactions_project_score" ON "Interactions"("projectId", "score");

-- CreateIndex
CREATE INDEX "idx_interactions_platform_created" ON "Interactions"("platform", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_interactions_platform_external" ON "Interactions"("platform", "externalId");
