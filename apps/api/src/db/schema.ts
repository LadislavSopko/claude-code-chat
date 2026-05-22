import { pgTable, text, timestamp, pgEnum, uuid } from "drizzle-orm/pg-core";

export const messageTypeEnum = pgEnum("message_type", ["TEXT", "SYSTEM", "COMMAND"]);
export const roomStatusEnum = pgEnum("room_status", ["ACTIVE", "ARCHIVED"]);
export const participantRoleEnum = pgEnum("participant_role", ["OWNER", "MEMBER", "OBSERVER"]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  status: roomStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  fromName: text("from_name").notNull(),
  toName: text("to_name"),
  text: text("text").notNull(),
  type: messageTypeEnum("type").notNull().default("TEXT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  role: participantRoleEnum("role").notNull().default("MEMBER"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});
