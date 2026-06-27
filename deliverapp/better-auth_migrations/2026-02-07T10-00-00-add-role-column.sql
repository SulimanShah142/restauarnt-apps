-- Migration to add role column to user table
ALTER TABLE "user" ADD COLUMN "role" TEXT DEFAULT 'delivery_person';