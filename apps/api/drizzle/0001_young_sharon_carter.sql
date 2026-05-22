ALTER TYPE "public"."participant_role" ADD VALUE 'HUMAN';--> statement-breakpoint
ALTER TYPE "public"."participant_role" ADD VALUE 'AGENT';--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "role" SET DEFAULT 'AGENT';