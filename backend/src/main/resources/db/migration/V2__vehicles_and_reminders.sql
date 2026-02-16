-- V2: Add Vehicle and VehicleReminder tables for ITP expiration tracking

-- Create Vehicle table
CREATE TABLE IF NOT EXISTS "Vehicle" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clientId" TEXT,
    "licensePlate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "itpExpiryDate" DATE,
    "insuranceExpiryDate" DATE,
    "rovinietaExpiryDate" DATE,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- Create VehicleReminder table to track sent ITP/insurance reminders
CREATE TABLE IF NOT EXISTS "VehicleReminder" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "vehicleId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL, -- 'ITP', 'INSURANCE', 'ROVINIETA'
    "expiryDate" DATE NOT NULL, -- The expiry date this reminder was for
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleReminder_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Vehicle_licensePlate_idx" ON "Vehicle"("licensePlate");
CREATE INDEX IF NOT EXISTS "Vehicle_clientId_idx" ON "Vehicle"("clientId");
CREATE INDEX IF NOT EXISTS "Vehicle_itpExpiryDate_idx" ON "Vehicle"("itpExpiryDate");
CREATE INDEX IF NOT EXISTS "VehicleReminder_vehicleId_idx" ON "VehicleReminder"("vehicleId");
CREATE INDEX IF NOT EXISTS "VehicleReminder_reminderType_idx" ON "VehicleReminder"("reminderType");

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_clientId_fkey" 
        FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "VehicleReminder" ADD CONSTRAINT "VehicleReminder_vehicleId_fkey" 
        FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
