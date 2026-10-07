-- CreateTable
CREATE TABLE "AtrakoConversation" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "actorKey" VARCHAR(160) NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT 'Nova conversa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtrakoConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtrakoMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'COMPLETE',
    "sources" JSONB,
    "toolContext" JSONB,
    "model" VARCHAR(120),
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostMicros" INTEGER,
    "durationMs" INTEGER,
    "traceId" VARCHAR(64),
    "clientRequestId" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtrakoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtrakoConversation_clienteId_actorKey_updatedAt_idx" ON "AtrakoConversation"("clienteId", "actorKey", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AtrakoMessage_clientRequestId_key" ON "AtrakoMessage"("clientRequestId");

-- CreateIndex
CREATE INDEX "AtrakoMessage_conversationId_createdAt_idx" ON "AtrakoMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AtrakoMessage_clienteId_createdAt_idx" ON "AtrakoMessage"("clienteId", "createdAt");

-- AddForeignKey
ALTER TABLE "AtrakoConversation" ADD CONSTRAINT "AtrakoConversation_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtrakoMessage" ADD CONSTRAINT "AtrakoMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AtrakoConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
