import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("User", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: text("emailVerified"),
  image: text("image"),
  passwordHash: text("passwordHash"),
  businessName: text("businessName"),
  businessEmail: text("businessEmail"),
  businessAddress: text("businessAddress"),
  businessPhone: text("businessPhone"),
  hstNumber: text("hstNumber"),
  logoUrl: text("logoUrl"),
  invoicePrefix: text("invoicePrefix").notNull().default("INV"),
  defaultPaymentTerms: text("defaultPaymentTerms").notNull().default("Net 30"),
  defaultTaxRate: real("defaultTaxRate").notNull().default(0),
  defaultCurrency: text("defaultCurrency").notNull().default("USD"),
  paymentInstructions: text("paymentInstructions"),
  defaultEmailSubject: text("defaultEmailSubject")
    .notNull()
    .default("Invoice {{invoiceNumber}} – {{period}}"),
  defaultEmailBody: text("defaultEmailBody")
    .notNull()
    .default(
      "Hi {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for the period {{period}}.\n\nAmount due: {{total}}\nDue date: {{dueDate}}\n\n{{paymentInstructions}}\n\nThank you for your business!\n{{senderName}}"
    ),
  createdAt: text("createdAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── NextAuth: Accounts / Sessions / VerificationTokens ──────────────────────

export const accounts = sqliteTable("Account", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("Session", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: text("expires").notNull(),
});

export const verificationTokens = sqliteTable("VerificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: text("expires").notNull(),
});

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = sqliteTable("Client", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  companyName: text("companyName"),
  email: text("email").notNull().default(""),
  billingAddress: text("billingAddress"),
  hourlyRate: real("hourlyRate"),
  fixedRate: real("fixedRate"),
  billingCycle: text("billingCycle", {
    enum: ["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"],
  })
    .notNull()
    .default("MONTHLY"),
  paymentTerms: text("paymentTerms").notNull().default("Net 30"),
  currency: text("currency").notNull().default("USD"),
  defaultNotes: text("defaultNotes"),
  emailTemplate: text("emailTemplate"),
  paymentInstructions: text("paymentInstructions"),
  isArchived: integer("isArchived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("createdAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = sqliteTable("Invoice", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("clientId")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  invoiceNumber: text("invoiceNumber").notNull().unique(),
  status: text("status", { enum: ["DRAFT", "SENT", "PAID", "OVERDUE"] })
    .notNull()
    .default("DRAFT"),
  billingType: text("billingType", { enum: ["HOURLY", "FIXED"] })
    .notNull()
    .default("HOURLY"),
  billingPeriodStart: text("billingPeriodStart"),
  billingPeriodEnd: text("billingPeriodEnd"),
  hoursWorked: real("hoursWorked"),
  hourlyRate: real("hourlyRate"),
  fixedAmount: real("fixedAmount"),
  subtotal: real("subtotal").notNull(),
  taxRate: real("taxRate").notNull().default(0),
  taxAmount: real("taxAmount").notNull(),
  total: real("total").notNull(),
  currency: text("currency").notNull().default("USD"),
  dueDate: text("dueDate"),
  sentAt: text("sentAt"),
  paidAt: text("paidAt"),
  paymentMethod: text("paymentMethod"),
  taskSummary: text("taskSummary"),
  notes: text("notes"),
  paymentInstructions: text("paymentInstructions"),
  privateNotes: text("privateNotes"),
  emailSubject: text("emailSubject"),
  emailBody: text("emailBody"),
  createdAt: text("createdAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Email Logs ───────────────────────────────────────────────────────────────

export const emailLogs = sqliteTable("EmailLog", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text("invoiceId")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  sentAt: text("sentAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  recipientEmail: text("recipientEmail").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("SENT"),
  errorMessage: text("errorMessage"),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  clients: many(clients),
  invoices: many(invoices),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  emailLogs: many(emailLogs),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  invoice: one(invoices, {
    fields: [emailLogs.invoiceId],
    references: [invoices.id],
  }),
}));
