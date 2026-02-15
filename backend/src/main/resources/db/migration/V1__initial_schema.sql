-- Database Schema Migration
-- This script creates all tables for the Client Management System

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
DO $$ BEGIN
    CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Client table
CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- Create Message table
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Create MessageQueue table
CREATE TABLE IF NOT EXISTS "MessageQueue" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "messageId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetry" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageQueue_pkey" PRIMARY KEY ("id")
);

-- Create MessageTemplate table
CREATE TABLE IF NOT EXISTS "MessageTemplate" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- Create OptOut table
CREATE TABLE IF NOT EXISTS "OptOut" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "phoneNumber" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OptOut_pkey" PRIMARY KEY ("id")
);

-- Create SystemConfig table
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Client_companyName_idx" ON "Client"("companyName");
CREATE INDEX IF NOT EXISTS "Client_phonePrimary_idx" ON "Client"("phonePrimary");
CREATE INDEX IF NOT EXISTS "Client_county_idx" ON "Client"("county");
CREATE INDEX IF NOT EXISTS "Client_category_idx" ON "Client"("category");
CREATE INDEX IF NOT EXISTS "Client_cui_idx" ON "Client"("cui");
CREATE INDEX IF NOT EXISTS "Client_caenCode_idx" ON "Client"("caenCode");

CREATE INDEX IF NOT EXISTS "Message_clientId_idx" ON "Message"("clientId");
CREATE INDEX IF NOT EXISTS "Message_status_idx" ON "Message"("status");
CREATE INDEX IF NOT EXISTS "Message_sentAt_idx" ON "Message"("sentAt");
CREATE INDEX IF NOT EXISTS "Message_phoneNumber_idx" ON "Message"("phoneNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageQueue_messageId_key" ON "MessageQueue"("messageId");
CREATE INDEX IF NOT EXISTS "MessageQueue_status_nextRetry_idx" ON "MessageQueue"("status", "nextRetry");
CREATE INDEX IF NOT EXISTS "MessageQueue_priority_idx" ON "MessageQueue"("priority");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplate_name_key" ON "MessageTemplate"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "OptOut_phoneNumber_key" ON "OptOut"("phoneNumber");
CREATE INDEX IF NOT EXISTS "OptOut_phoneNumber_idx" ON "OptOut"("phoneNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "SystemConfig_key_key" ON "SystemConfig"("key");

-- Add foreign key constraint (with ON DELETE CASCADE)
DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_clientId_fkey" 
        FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
