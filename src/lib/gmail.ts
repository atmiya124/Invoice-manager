import { google } from "googleapis";
import { db } from "@/lib/db";

/**
 * Creates an authenticated Gmail OAuth2 client for a given user.
 * Automatically refreshes the access token if expired.
 */
async function getGmailClient(userId: string) {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
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
      await db.account.update({
        where: { id: account.id },
        data: {
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : undefined,
        },
      });
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
  subject: string;
  body: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
  fromName?: string;
}): Promise<void> {
  const { userId, to, subject, body, pdfBuffer, pdfFilename, fromName } = params;

  const gmail = await getGmailClient(userId);

  const boundary = `boundary_${Date.now()}`;
  const pdfBase64 = pdfBuffer.toString("base64");
  const fromDisplay = fromName ? `${fromName}` : "";

  // Build the raw MIME message
  const rawMessage = [
    `From: ${fromDisplay}`,
    `To: ${to}`,
    `Subject: ${subject}`,
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
