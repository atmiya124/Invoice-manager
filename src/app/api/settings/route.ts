import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/schema";
import { settingsSchema } from "@/lib/validations";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      name: true,
      email: true,
      image: true,
      businessName: true,
      businessEmail: true,
      businessAddress: true,
      businessPhone: true,
      hstNumber: true,
      logoUrl: true,
      invoicePrefix: true,
      defaultPaymentTerms: true,
      defaultTaxRate: true,
      defaultCurrency: true,
      paymentInstructions: true,
      defaultEmailSubject: true,
      defaultEmailBody: true,
    },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Check if Gmail is connected (account with gmail scope exists)
  const gmailAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, session.user.id), eq(accounts.provider, "google")),
  });
  const gmailConnected = gmailAccount?.scope?.includes("gmail") ?? false;

  return Response.json({
    ...user,
    defaultTaxRate: Number(user.defaultTaxRate),
    gmailConnected,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const [user] = await db
    .update(users)
    .set({
      name: parsed.data.name,
      businessName: parsed.data.businessName || null,
      businessEmail: parsed.data.businessEmail || null,
      businessAddress: parsed.data.businessAddress || null,
      businessPhone: parsed.data.businessPhone || null,
      hstNumber: parsed.data.hstNumber || null,
      invoicePrefix: parsed.data.invoicePrefix,
      defaultPaymentTerms: parsed.data.defaultPaymentTerms,
      defaultTaxRate: parsed.data.defaultTaxRate,
      defaultCurrency: parsed.data.defaultCurrency,
      paymentInstructions: parsed.data.paymentInstructions || null,
      defaultEmailSubject: parsed.data.defaultEmailSubject,
      defaultEmailBody: parsed.data.defaultEmailBody,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, session.user.id))
    .returning();

  return Response.json({ ...user, defaultTaxRate: Number(user.defaultTaxRate) });
}

