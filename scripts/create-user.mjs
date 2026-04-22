import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import path from "path";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Manually parse .env.local
const envPath = path.resolve(__dirname, "../.env.local");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) process.env[match[1]] = match[2];
  }
} catch {}

const url = process.env.DATABASE_URL ?? `file:${path.resolve(__dirname, "../prisma/dev.db")}`;
const authToken = process.env.DATABASE_AUTH_TOKEN;
console.log("DB:", url);

const libsqlClient = createClient({ url, ...(authToken ? { authToken } : {}) });
const db = drizzle(libsqlClient);

const hash = await bcrypt.hash("Password123", 10);
const id = crypto.randomUUID();
const now = new Date().toISOString();

await libsqlClient.execute({
  sql: `INSERT INTO User (id, email, name, passwordHash, invoicePrefix, defaultPaymentTerms, defaultTaxRate, defaultCurrency, defaultEmailSubject, defaultEmailBody, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'INV', 'Net 30', 0, 'USD', 'Invoice {{invoiceNumber}}', '', ?, ?)
        ON CONFLICT(email) DO UPDATE SET passwordHash = excluded.passwordHash`,
  args: [id, "atmiya124@gmail.com", "Atmiya", hash, now, now],
});

const result = await libsqlClient.execute({
  sql: "SELECT id, email FROM User WHERE email = ?",
  args: ["atmiya124@gmail.com"],
});
const user = result.rows[0];
console.log("✓ User ready:", user.id, user.email);
libsqlClient.close();

