-- CreateTable
CREATE TABLE "AnalystConversation" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "actorKey" VARCHAR(128) NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT 'Nova análise',
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'COMPLETE',
    "sources" JSONB,
    "toolContext" JSONB,
    "model" VARCHAR(80),
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostMicros" INTEGER,
    "clientRequestId" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalystMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalystConversation_clienteId_actorKey_updatedAt_idx" ON "AnalystConversation"("clienteId", "actorKey", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalystMessage_clientRequestId_key" ON "AnalystMessage"("clientRequestId");

-- CreateIndex
CREATE INDEX "AnalystMessage_conversationId_createdAt_idx" ON "AnalystMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AnalystConversation" ADD CONSTRAINT "AnalystConversation_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystMessage" ADD CONSTRAINT "AnalystMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AnalystConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;