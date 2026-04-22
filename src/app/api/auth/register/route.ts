import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      email,
      name: name?.trim() || email.split("@")[0],
      passwordHash,
    }).returning();
    console.log("[register] created user:", user.id, user.email);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "Server error. Check the terminal for details." }, { status: 500 });
  }
}
