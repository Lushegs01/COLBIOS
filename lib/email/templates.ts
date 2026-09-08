import { formatMoney } from "@/lib/format/money";

/**
 * Transactional email content.
 *
 * Plain HTML with inline styles — email clients on Android and Outlook ignore
 * stylesheets — plus a text alternative, because a confirmation that only
 * renders in a rich client is not a confirmation.
 */

export type ConfirmationEmailData = {
  fullName: string;
  matricNumber: string;
  department: string;
  levelLabel: string;
  sessionName: string;
  feeName: string;
  amount: number;
  currency: string;
  reference: string;
  receiptNumber: string;
  paidAt: Date;
  channel: string | null;
  receiptUrl: string;
  verifyUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export function confirmationSubject(data: ConfirmationEmailData): string {
  return `COLBIOS Dues Payment Confirmation — ${data.receiptNumber}`;
}

export function confirmationText(data: ConfirmationEmailData): string {
  return [
    "COLBIOS DUES PAYMENT CONFIRMATION",
    "College of Biosciences, Federal University of Agriculture, Abeokuta",
    "",
    `Hello ${data.fullName},`,
    "",
    "Your COLBIOS dues payment has been verified. Details are below.",
    "",
    `Student:          ${data.fullName}`,
    `Matric Number:    ${data.matricNumber}`,
    `Department:       ${data.department}`,
    `Level:            ${data.levelLabel}`,
    `Academic Session: ${data.sessionName}`,
    "",
    `Fee:              ${data.feeName}`,
    `Amount Paid:      ${formatMoney(data.amount, data.currency)}`,
    `Payment Channel:  ${data.channel ?? "—"}`,
    `Payment Date:     ${dateFormatter.format(data.paidAt)}`,
    "",
    `Payment Reference: ${data.reference}`,
    `Receipt Number:    ${data.receiptNumber}`,
    "",
    `View or download your receipt: ${data.receiptUrl}`,
    `Verify this payment:           ${data.verifyUrl}`,
    "",
    "Keep this email for your records.",
  ].join("\n");
}

export function confirmationHtml(data: ConfirmationEmailData): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:#6B7280;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#111111;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
    </tr>`;

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;background:#0B5D4A;color:#FFFFFF;">
          <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">COLBIOS</div>
          <div style="font-size:12px;opacity:0.85;margin-top:2px;">College of Biosciences · FUNAAB</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <div style="display:inline-block;padding:5px 10px;border-radius:999px;background:#DFF0E9;color:#0B5D4A;font-size:12px;font-weight:700;">PAYMENT VERIFIED</div>
          <h1 style="margin:16px 0 6px;font-size:20px;color:#111111;">Payment confirmed</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#6B7280;">
            Hello ${escapeHtml(data.fullName)}, your COLBIOS dues payment for the
            ${escapeHtml(data.sessionName)} session has been verified.
          </p>

          <div style="padding:16px 18px;border:1px solid #E5E7EB;border-radius:12px;">
            <div style="font-size:12px;color:#6B7280;">Amount paid</div>
            <div style="font-size:26px;font-weight:700;color:#0B5D4A;margin-top:2px;">
              ${escapeHtml(formatMoney(data.amount, data.currency))}
            </div>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;">
            ${row("Student", data.fullName)}
            ${row("Matric Number", data.matricNumber)}
            ${row("Department", data.department)}
            ${row("Level", data.levelLabel)}
            ${row("Academic Session", data.sessionName)}
            ${row("Fee", data.feeName)}
            ${row("Payment Channel", data.channel ?? "—")}
            ${row("Payment Date", dateFormatter.format(data.paidAt))}
            ${row("Payment Reference", data.reference)}
            ${row("Receipt Number", data.receiptNumber)}
          </table>

          <div style="margin-top:24px;">
            <a href="${escapeHtml(data.receiptUrl)}" style="display:inline-block;padding:12px 18px;background:#0B5D4A;color:#FFFFFF;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">View receipt</a>
            <a href="${escapeHtml(data.verifyUrl)}" style="display:inline-block;padding:12px 18px;margin-left:8px;color:#0B5D4A;text-decoration:none;border:1px solid #C2DFD3;border-radius:10px;font-size:14px;font-weight:600;">Verify payment</a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;border-top:1px solid #E5E7EB;color:#6B7280;font-size:12px;line-height:1.6;">
          This confirmation was sent after the payment was verified with the payment provider.
          Keep it for your records. If you did not make this payment, contact the college office.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
