import { google } from "googleapis";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

/**
 * Creates an authenticated Gmail OAuth2 client for a given user.
 * Automatically refreshes the access token if expired.
 */
async function getGmailClient(userId: string) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });

  if (!account?.access_token && !account?.refresh_token) {
    throw new Error(
      "No Google account linked. Please sign out and sign back in with Google."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Refresh if token is expired or about to expire (within 5 minutes)
  const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;
  if (expiresAt < Date.now() + 5 * 60 * 1000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await db
        .update(accounts)
        .set({
          access_token: credentials.access_token ?? undefined,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : undefined,
        })
        .where(eq(accounts.id, account.id));
      oauth2Client.setCredentials(credentials);
    } catch {
      throw new Error(
        "Failed to refresh Gmail token. Please sign out and sign back in."
      );
    }
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Sends an invoice email via Gmail API with the PDF attached.
 */
export async function sendInvoiceEmail(params: {
  userId: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
  fromName?: string;
}): Promise<void> {
  const { userId, to, cc, subject, body, pdfBuffer, pdfFilename, fromName } = params;

  const gmail = await getGmailClient(userId);

  // Fetch the sender's email address for the From: header
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  });
  const senderEmail = userRecord?.email ?? "";

  const boundary = `boundary_${Date.now()}`;
  const pdfBase64 = pdfBuffer.toString("base64");
  const fromHeader = fromName
    ? `${fromName} <${senderEmail}>`
    : senderEmail;

  // Build the raw MIME message
  const ccHeader = cc && cc.length > 0 ? cc.join(", ") : null;
  const rawMessage = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    ...(ccHeader ? [`Cc: ${ccHeader}`] : []),
    `Subject: ${subject}`,
    `Reply-To: ${senderEmail}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });
}
