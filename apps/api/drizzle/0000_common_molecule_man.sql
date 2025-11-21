CREATE TABLE IF NOT EXISTS "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"incident_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"damage_level" real,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "laps" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"lap_time" real NOT NULL,
	"is_valid_lap" boolean DEFAULT true,
	"sector1_time" real,
	"sector2_time" real,
	"sector3_time" real,
	"fuel_used" real,
	"fuel_remaining" real,
	"avg_tire_temp" real,
	"avg_tire_wear" real,
	"incident_count" integer DEFAULT 0,
	"position" integer,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opponents" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"car_idx" integer NOT NULL,
	"driver_name" varchar(255) NOT NULL,
	"car_number" varchar(50) NOT NULL,
	"car_class" varchar(100) NOT NULL,
	"best_lapTime" real,
	"last_lap_time" real,
	"current_lap" integer,
	"position" integer,
	"class_position" integer,
	"laps_completed" integer,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pit_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"pit_in_time" timestamp NOT NULL,
	"pit_out_time" timestamp,
	"stop_duration" real,
	"fuel_added" real,
	"tires_changed" boolean DEFAULT false,
	"damage_repaired" boolean DEFAULT false,
	"penalty_served" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"track_name" varchar(255) NOT NULL,
	"car_name" varchar(255) NOT NULL,
	"driver_name" varchar(255) NOT NULL,
	"session_type" varchar(50) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"total_laps" integer,
	"best_lap_time" real,
	"average_lap_time" real,
	"final_position" integer,
	"is_completed" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strategy_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"recommendation_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" varchar(1000) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"optimal_lap" integer,
	"window_start" integer,
	"window_end" integer,
	"expected_gain" real,
	"confidence" real,
	"metadata" jsonb,
	"is_actioned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telemetry_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"lap_dist_pct" real NOT NULL,
	"speed" real NOT NULL,
	"rpm" integer NOT NULL,
	"gear" integer NOT NULL,
	"throttle" real NOT NULL,
	"brake" real NOT NULL,
	"steering_angle" real,
	"fuel_level" real,
	"tire_temp_lf" real,
	"tire_temp_rf" real,
	"tire_temp_lr" real,
	"tire_temp_rr" real,
	"tire_wear_lf" real,
	"tire_wear_rf" real,
	"tire_wear_lr" real,
	"tire_wear_rr" real,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "laps" ADD CONSTRAINT "laps_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opponents" ADD CONSTRAINT "opponents_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pit_stops" ADD CONSTRAINT "pit_stops_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strategy_recommendations" ADD CONSTRAINT "strategy_recommendations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telemetry_snapshots" ADD CONSTRAINT "telemetry_snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_session_id_idx" ON "incidents" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_lap_number_idx" ON "incidents" USING btree ("lap_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "laps_session_id_idx" ON "laps" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "laps_lap_number_idx" ON "laps" USING btree ("lap_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "laps_timestamp_idx" ON "laps" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opponents_session_id_idx" ON "opponents" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opponents_car_idx_idx" ON "opponents" USING btree ("car_idx");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opponents_timestamp_idx" ON "opponents" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pit_stops_session_id_idx" ON "pit_stops" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pit_stops_lap_number_idx" ON "pit_stops" USING btree ("lap_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_id_idx" ON "sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "start_time_idx" ON "sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_name_idx" ON "sessions" USING btree ("driver_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_session_id_idx" ON "strategy_recommendations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_type_idx" ON "strategy_recommendations" USING btree ("recommendation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_created_at_idx" ON "strategy_recommendations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telemetry_session_id_idx" ON "telemetry_snapshots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telemetry_lap_number_idx" ON "telemetry_snapshots" USING btree ("lap_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telemetry_timestamp_idx" ON "telemetry_snapshots" USING btree ("timestamp");