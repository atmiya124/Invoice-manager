import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../prisma/dev.db").replace(/\\/g, "/");
const url = `file:${dbPath}`;
console.log("DB:", url);

const adapter = new PrismaLibSql({ url });
const db = new PrismaClient({ adapter });

const hash = await bcrypt.hash("Password123", 10);
const user = await db.user.upsert({
  where: { email: "atmiya124@gmail.com" },
  update: { passwordHash: hash },
  create: { email: "atmiya124@gmail.com", name: "Atmiya", passwordHash: hash },
});
console.log("✓ User ready:", user.id, user.email);
await db.$disconnect();
