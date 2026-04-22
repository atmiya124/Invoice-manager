import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../src/lib/schema";
import { users } from "../src/lib/schema";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  console.log("DB:", url);

  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  const db = drizzle(client, { schema });

  const hash = await bcrypt.hash("Password123", 10);
  await db
    .insert(users)
    .values({ email: "atmiya124@gmail.com", name: "Atmiya", passwordHash: hash })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash: hash } });

  const user = (await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, "atmiya124@gmail.com"),
  }))!;
  console.log("✓ User ready:", user.id, user.email);
  client.close();
}

main().catch(console.error);


main().catch((e) => { console.error(e); process.exit(1); });
