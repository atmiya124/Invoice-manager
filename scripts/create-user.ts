import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import path from "path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const url = dbUrl.startsWith("file:.")
    ? `file:///${path.resolve(process.cwd(), dbUrl.slice(5)).replace(/\\/g, "/")}`
    : dbUrl;

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
}

main().catch((e) => { console.error(e); process.exit(1); });
