import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  // Resolve relative file: paths to absolute with forward slashes for libsql
  if (url.startsWith("file:.")) {
    const relativePath = url.slice(5);
    const abs = path.resolve(process.cwd(), relativePath).replace(/\\/g, "/");
    return `file:///${abs}`;
  }
  return url;
}

function createPrismaClient() {
  const url = getDatabaseUrl();
  console.log("[db] connecting to:", url);
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
