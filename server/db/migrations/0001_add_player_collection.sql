-- Idempotent migration: tilføjer player_collection-tabel + unique-indexes
-- Trygt at køre flere gange.

CREATE TABLE IF NOT EXISTS "player_collection" (
  "id" serial PRIMARY KEY NOT NULL,
  "player_nickname" varchar(20) NOT NULL,
  "image_id" integer NOT NULL,
  "unlocked_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_collection_unique_idx"
  ON "player_collection" USING btree ("player_nickname", "image_id");

CREATE INDEX IF NOT EXISTS "player_collection_nickname_idx"
  ON "player_collection" USING btree ("player_nickname");

CREATE UNIQUE INDEX IF NOT EXISTS "player_achievements_unique_idx"
  ON "player_achievements" USING btree ("player_nickname", "achievement");
