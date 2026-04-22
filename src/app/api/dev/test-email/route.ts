/**
 * DEV ONLY — sends a test email to verify Gmail OAuth is working.
 * Hit GET /api/dev/test-email after signing in with Google.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendInvoiceEmail } from "@/lib/gmail";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json(
      { error: "Not signed in. Sign in with Google at /login first." },
      { status: 401 }
    );
  }

  const to = req.nextUrl.searchParams.get("to") ?? "atmiyapatelleo9@gmail.com";

  const testPdf = Buffer.from("%PDF-1.4 test", "utf-8");

  try {
    await sendInvoiceEmail({
      userId: session.user.id,
      to,
      subject: "Test email from FreelanceInvoice",
      body: "This is a test email to verify the Gmail send integration is working correctly.\n\nIf you received this, everything is set up properly!",
      pdfBuffer: testPdf,
      pdfFilename: "test.pdf",
      fromName: session.user.name ?? "FreelanceInvoice",
    });

    return Response.json({ success: true, sentTo: to, from: session.user.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
