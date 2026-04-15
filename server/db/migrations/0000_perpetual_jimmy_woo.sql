CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_nickname" varchar(20) NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"wrong" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"difficulty" varchar(20) DEFAULT 'rookie',
	"duration_ms" integer,
	"played_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_nickname" varchar(20) NOT NULL,
	"achievement" varchar(50) NOT NULL,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_collection" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_nickname" varchar(20) NOT NULL,
	"image_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"nickname" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "player_achievements_unique_idx" ON "player_achievements" USING btree ("player_nickname","achievement");--> statement-breakpoint
CREATE UNIQUE INDEX "player_collection_unique_idx" ON "player_collection" USING btree ("player_nickname","image_id");--> statement-breakpoint
CREATE INDEX "player_collection_nickname_idx" ON "player_collection" USING btree ("player_nickname");