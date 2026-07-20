import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("whatsapp_sessions", {
  id: text("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  countryCode: text("country_code").notNull(),
  pairingMethod: text("pairing_method", { enum: ["qr", "code"] }).notNull(),
  sessionType: text("session_type", { enum: ["temporary", "permanent"] }).notNull(),
  status: text("status", {
    enum: [
      "pending",
      "connecting",
      "awaiting_scan",
      "awaiting_code_entry",
      "paired",
      "uploading",
      "applying",
      "completed",
      "failed",
      "logged_out",
    ],
  })
    .notNull()
    .default("pending"),
  pairingCode: text("pairing_code"),
  uploadId: text("upload_id"),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
