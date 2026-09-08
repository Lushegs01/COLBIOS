import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import { absoluteUrl } from "@/lib/env";
import { levelLabel, type LevelCode } from "@/lib/format/level";
import { formatMoney } from "@/lib/format/money";
import type { Payment, Receipt } from "@/lib/generated/prisma/client";

/**
 * The receipt PDF.
 *
 * Laid out like an institutional financial document — a college header rule, a
 * bordered particulars block, an issued-by footer and a verification QR — not
 * like a SaaS invoice.
 *
 * The font is a subset of DejaVu Sans embedded in the document rather than one
 * of the PDF standard fonts. That is not cosmetic: the standard fonts use
 * WinAnsi encoding, which cannot represent the naira sign (₦) *or* the Yoruba
 * characters in names like Ọlásùnkànmí — a receipt built on them would either
 * crash or silently mangle a student's own name.
 *
 * The "PAYMENT VERIFIED" stamp is only drawn for a payment whose status is
 * SUCCESS; an unverified payment can never produce a receipt that looks paid.
 */

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const PINE = rgb(0.043, 0.365, 0.29); // #0B5D4A
const INK = rgb(0.067, 0.067, 0.067);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.898, 0.906, 0.922);
const PAPER = rgb(0.98, 0.98, 0.972);

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

type Fonts = { regular: PDFFont; bold: PDFFont };

const FONT_DIR = path.join(process.cwd(), "lib", "receipts", "fonts");

/** Read once per process; the files are ~45KB each. */
let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadFontBytes(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    readFile(path.join(FONT_DIR, "receipt-sans-regular.ttf")),
    readFile(path.join(FONT_DIR, "receipt-sans-bold.ttf")),
  ]);
  fontCache = { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
  return fontCache;
}

/**
 * Characters the embedded font subset can draw: Latin, Latin-1, Latin Extended-A
 * and Latin Extended Additional (which is what carries ẹ, ọ and ṣ), plus the
 * punctuation and currency signs the layout uses.
 */
const SUPPORTED_GLYPHS =
  /^[\u0020-\u007E\u00A0-\u00FF\u0100-\u017F\u1E00-\u1EFF\u2013\u2014\u2018-\u201D\u2020-\u2022\u2026\u2030\u20A6\u00B7]*$/;

/**
 * Make arbitrary text safe to draw.
 *
 * A name that is entirely within the font's coverage — including Yoruba
 * diacritics — is passed through untouched. Anything outside it is decomposed
 * to its base letters where that is possible, and only what remains
 * unrepresentable becomes a placeholder. A student's name is never silently
 * dropped, and an unusual character can never crash a receipt.
 */
export function pdfSafe(text: string): string {
  const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, " ");
  if (SUPPORTED_GLYPHS.test(cleaned)) return cleaned;

  const decomposed = cleaned.normalize("NFD").replace(/\p{M}+/gu, "");
  return [...decomposed]
    .map((character) => (SUPPORTED_GLYPHS.test(character) ? character : "?"))
    .join("");
}

export async function buildReceiptPdf(payment: Payment, receipt: Receipt): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`COLBIOS Dues Receipt ${receipt.receiptNumber}`);
  pdf.setAuthor("College of Biosciences, Federal University of Agriculture, Abeokuta");
  pdf.setSubject(`COLBIOS dues payment receipt — ${payment.sessionName}`);
  pdf.setProducer("COLBIOS Dues Payment Platform");
  pdf.setCreationDate(receipt.issuedAt);

  pdf.registerFontkit(fontkit);
  const fontBytes = await loadFontBytes();

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(fontBytes.regular, { subset: true }),
    bold: await pdf.embedFont(fontBytes.bold, { subset: true }),
  };

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: PAPER,
  });

  let y = PAGE_HEIGHT - MARGIN;
  y = drawHeader(page, fonts, y);
  y = drawTitleBlock(page, fonts, y, payment, receipt);
  y = drawStudentBlock(page, fonts, y, payment);
  y = drawPaymentBlock(page, fonts, y, payment, receipt);
  await drawVerificationBlock(pdf, page, fonts, y, payment);
  drawFooter(page, fonts);

  return pdf.save();
}

function drawHeader(page: PDFPage, fonts: Fonts, top: number): number {
  const monogramSize = 34;
  page.drawRectangle({
    x: MARGIN,
    y: top - monogramSize,
    width: monogramSize,
    height: monogramSize,
    color: PINE,
  });
  page.drawText("CB", {
    x: MARGIN + 7,
    y: top - monogramSize + 12,
    size: 13,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });

  page.drawText("COLBIOS", {
    x: MARGIN + monogramSize + 12,
    y: top - 14,
    size: 16,
    font: fonts.bold,
    color: INK,
  });
  page.drawText("College of Biosciences", {
    x: MARGIN + monogramSize + 12,
    y: top - 27,
    size: 9.5,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawText("Federal University of Agriculture, Abeokuta", {
    x: MARGIN + monogramSize + 12,
    y: top - 38,
    size: 9.5,
    font: fonts.regular,
    color: MUTED,
  });

  const line = top - monogramSize - 18;
  page.drawLine({
    start: { x: MARGIN, y: line },
    end: { x: PAGE_WIDTH - MARGIN, y: line },
    thickness: 1.5,
    color: PINE,
  });

  return line - 30;
}

function drawTitleBlock(
  page: PDFPage,
  fonts: Fonts,
  top: number,
  payment: Payment,
  receipt: Receipt,
): number {
  page.drawText("PAYMENT RECEIPT", {
    x: MARGIN,
    y: top,
    size: 19,
    font: fonts.bold,
    color: INK,
  });

  page.drawText(pdfSafe(`Academic Session ${payment.sessionName}`), {
    x: MARGIN,
    y: top - 16,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  });

  // Verified stamp — only ever drawn for a SUCCESS payment.
  if (payment.status === "SUCCESS") {
    const label = "PAYMENT VERIFIED";
    const width = fonts.bold.widthOfTextAtSize(label, 9) + 20;
    const x = PAGE_WIDTH - MARGIN - width;
    page.drawRectangle({
      x,
      y: top - 5,
      width,
      height: 22,
      color: rgb(0.875, 0.941, 0.914),
      borderColor: PINE,
      borderWidth: 0.8,
    });
    page.drawText(label, { x: x + 10, y: top + 1, size: 9, font: fonts.bold, color: PINE });
  }

  const receiptLine = pdfSafe(`Receipt No. ${receipt.receiptNumber}`);
  page.drawText(receiptLine, {
    x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(receiptLine, 9.5),
    y: top - 16,
    size: 9.5,
    font: fonts.regular,
    color: MUTED,
  });

  return top - 42;
}

function sectionHeading(page: PDFPage, fonts: Fonts, text: string, y: number): number {
  page.drawText(text.toUpperCase(), {
    x: MARGIN,
    y,
    size: 8.5,
    font: fonts.bold,
    color: MUTED,
  });
  return y - 14;
}

function drawFieldGrid(
  page: PDFPage,
  fonts: Fonts,
  top: number,
  fields: Array<[string, string]>,
): number {
  const columnWidth = (PAGE_WIDTH - MARGIN * 2) / 2;
  const rowHeight = 34;
  let y = top;

  fields.forEach(([label, value], index) => {
    const column = index % 2;
    const x = MARGIN + column * columnWidth;
    if (column === 0 && index > 0) y -= rowHeight;

    page.drawText(label, { x, y, size: 8.5, font: fonts.regular, color: MUTED });
    page.drawText(truncate(pdfSafe(value), fonts.bold, 11, columnWidth - 16), {
      x,
      y: y - 14,
      size: 11,
      font: fonts.bold,
      color: INK,
    });
  });

  return y - rowHeight - 6;
}

function drawStudentBlock(page: PDFPage, fonts: Fonts, top: number, payment: Payment): number {
  const y = sectionHeading(page, fonts, "Student particulars", top);
  const next = drawFieldGrid(page, fonts, y - 4, [
    ["Full Name", payment.fullName],
    ["Matric Number", payment.matricNumber],
    ["Department", payment.departmentName],
    ["Level", levelLabel(payment.level as LevelCode)],
  ]);

  page.drawLine({
    start: { x: MARGIN, y: next + 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: next + 8 },
    thickness: 0.7,
    color: LINE,
  });

  return next - 12;
}

function drawPaymentBlock(
  page: PDFPage,
  fonts: Fonts,
  top: number,
  payment: Payment,
  receipt: Receipt,
): number {
  let y = sectionHeading(page, fonts, "Payment particulars", top);

  // Amount panel — the number a reader looks for first.
  const panelHeight = 56;
  y -= panelHeight - 6;
  page.drawRectangle({
    x: MARGIN,
    y,
    width: PAGE_WIDTH - MARGIN * 2,
    height: panelHeight,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 1,
  });
  page.drawText(pdfSafe(payment.feeName), {
    x: MARGIN + 16,
    y: y + panelHeight - 22,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawText("Amount Paid", {
    x: MARGIN + 16,
    y: y + 16,
    size: 8.5,
    font: fonts.regular,
    color: MUTED,
  });

  const amount = pdfSafe(formatMoney(payment.amount, payment.currency));
  page.drawText(amount, {
    x: PAGE_WIDTH - MARGIN - 16 - fonts.bold.widthOfTextAtSize(amount, 22),
    y: y + 18,
    size: 22,
    font: fonts.bold,
    color: PINE,
  });

  const paidAt = payment.paidAt ?? receipt.issuedAt;
  const next = drawFieldGrid(page, fonts, y - 26, [
    ["Payment Reference", payment.reference],
    ["Receipt Number", receipt.receiptNumber],
    ["Payment Date", dateFormatter.format(paidAt)],
    ["Payment Channel", formatChannel(payment.channel)],
    ["Academic Session", payment.sessionName],
    ["Payment Method", payment.isManualAdjustment ? "Manual adjustment (not Paystack)" : "Paystack"],
  ]);

  return next;
}

async function drawVerificationBlock(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  top: number,
  payment: Payment,
): Promise<void> {
  const verifyUrl = absoluteUrl(`/verify/${payment.reference}`);
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
  const qrImage = await pdf.embedPng(qrPng);

  const boxHeight = 108;
  const y = Math.max(top - boxHeight - 6, MARGIN + 70);

  page.drawRectangle({
    x: MARGIN,
    y,
    width: PAGE_WIDTH - MARGIN * 2,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 1,
  });

  const qrSize = 78;
  page.drawImage(qrImage, {
    x: MARGIN + 14,
    y: y + (boxHeight - qrSize) / 2,
    width: qrSize,
    height: qrSize,
  });

  const textX = MARGIN + 14 + qrSize + 16;
  page.drawText("VERIFY THIS RECEIPT", {
    x: textX,
    y: y + boxHeight - 26,
    size: 8.5,
    font: fonts.bold,
    color: MUTED,
  });
  page.drawText("Scan the code or open the link below to confirm", {
    x: textX,
    y: y + boxHeight - 42,
    size: 9.5,
    font: fonts.regular,
    color: INK,
  });
  page.drawText("this payment against COLBIOS records.", {
    x: textX,
    y: y + boxHeight - 54,
    size: 9.5,
    font: fonts.regular,
    color: INK,
  });
  page.drawText(truncate(pdfSafe(verifyUrl), fonts.bold, 9, PAGE_WIDTH - MARGIN * 2 - qrSize - 50), {
    x: textX,
    y: y + 18,
    size: 9,
    font: fonts.bold,
    color: PINE,
  });
}

function drawFooter(page: PDFPage, fonts: Fonts): void {
  const y = MARGIN + 16;
  page.drawLine({
    start: { x: MARGIN, y: y + 26 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 26 },
    thickness: 0.7,
    color: LINE,
  });

  page.drawText(
    "Issued electronically by the College of Biosciences, FUNAAB. No signature is required.",
    { x: MARGIN, y: y + 12, size: 8, font: fonts.regular, color: MUTED },
  );
  page.drawText(
    "This receipt is valid only if it can be verified at the address above.",
    { x: MARGIN, y: y + 1, size: 8, font: fonts.regular, color: MUTED },
  );
}

function formatChannel(channel: string | null): string {
  if (!channel) return "—";
  return channel
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Trim to fit a column, with an ellipsis, so long values never overlap. */
function truncate(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Data-URL QR for the on-screen receipt, so the page needs no client JS. */
export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}
