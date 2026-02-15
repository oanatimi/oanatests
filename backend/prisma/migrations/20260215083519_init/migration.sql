-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "status" TEXT,
    "category" TEXT,
    "cui" TEXT,
    "registrationNumber" TEXT,
    "caenCode" TEXT,
    "caenSection" TEXT,
    "caenDivision" TEXT,
    "caenGroup" TEXT,
    "county" TEXT,
    "locality" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "revenue" DOUBLE PRECISION,
    "netProfit" DOUBLE PRECISION,
    "vatPayer" BOOLEAN,
    "revenue2023" DOUBLE PRECISION,
    "revenue2022" DOUBLE PRECISION,
    "profit2023" DOUBLE PRECISION,
    "profit2022" DOUBLE PRECISION,
    "receivables2023" DOUBLE PRECISION,
    "equity2023" DOUBLE PRECISION,
    "employees" INTEGER,
    "foundingYear" INTEGER,
    "phoneVerified" TEXT,
    "phonePrimary" TEXT,
    "phoneSecondary" TEXT,
    "phoneContact" TEXT,
    "phoneMarketing" TEXT,
    "phoneWebsite" TEXT,
    "emailPrimary" TEXT,
    "emailSecondary" TEXT,
    "emailMarketing" TEXT,
    "emailWebsite" TEXT,
    "emailContact" TEXT,
    "websites" TEXT,
    "administrator" TEXT,
    "contactPerson" TEXT,
    "contactDate" TIMESTAMP(3),
    "dealId" TEXT,
    "observations" TEXT,
    "sourceFile" TEXT,
    "sourceSheet" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageQueue" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetry" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptOut" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");

-- CreateIndex
CREATE INDEX "Client_phonePrimary_idx" ON "Client"("phonePrimary");

-- CreateIndex
CREATE INDEX "Client_county_idx" ON "Client"("county");

-- CreateIndex
CREATE INDEX "Client_category_idx" ON "Client"("category");

-- CreateIndex
CREATE INDEX "Message_clientId_idx" ON "Message"("clientId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Message_sentAt_idx" ON "Message"("sentAt");

-- CreateIndex
CREATE INDEX "Message_phoneNumber_idx" ON "Message"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MessageQueue_messageId_key" ON "MessageQueue"("messageId");

-- CreateIndex
CREATE INDEX "MessageQueue_status_nextRetry_idx" ON "MessageQueue"("status", "nextRetry");

-- CreateIndex
CREATE INDEX "MessageQueue_priority_idx" ON "MessageQueue"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_name_key" ON "MessageTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OptOut_phoneNumber_key" ON "OptOut"("phoneNumber");

-- CreateIndex
CREATE INDEX "OptOut_phoneNumber_idx" ON "OptOut"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
