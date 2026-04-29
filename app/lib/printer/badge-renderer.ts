import type { Font, Bitmap } from "bdfparser";
import { BADGE_WIDTH, planBadge } from "./badge-layout";
import { renderQrToCanvas } from "./qr";

export type BadgeArgs = {
  companyName: string;
  groupName: string;
  groupSize: number;
  qrUrl: string;
};

const COMPANY_NAME_SCALE = 2;
const QR_SIZE = 224;

function bitmapPixelSize(bitmap: Bitmap, scale: number) {
  return {
    width: bitmap.width() * scale,
    height: bitmap.height() * scale,
  };
}

function drawBitmapCentered(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  scale: number,
  y: number,
) {
  const { width: bw, height: bh } = bitmapPixelSize(bitmap, scale);
  const x = Math.floor((BADGE_WIDTH - bw) / 2);
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  bitmap.draw2canvas(ctx, { "0": null, "1": "#000000", "2": "#000000" });
  ctx.restore();
  return { width: bw, height: bh };
}

export async function renderBadgeToCanvas(
  canvas: HTMLCanvasElement,
  args: BadgeArgs,
  font: Font,
): Promise<void> {
  const companyBitmap = font.draw(args.companyName);
  const groupNameBitmap = font.draw(args.groupName);
  const sizeBitmap = font.draw(`人数: ${args.groupSize} 名`);

  const layout = planBadge({
    companyNameHeight: companyBitmap.height() * COMPANY_NAME_SCALE,
    groupNameHeight: groupNameBitmap.height(),
    groupSizeHeight: sizeBitmap.height(),
    qrSize: QR_SIZE,
  });

  canvas.width = BADGE_WIDTH;
  canvas.height = layout.totalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context for badge canvas");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBitmapCentered(ctx, companyBitmap, COMPANY_NAME_SCALE, layout.companyName.y);
  drawBitmapCentered(ctx, groupNameBitmap, 1, layout.groupName.y);
  drawBitmapCentered(ctx, sizeBitmap, 1, layout.groupSize.y);

  const qrCanvas = await renderQrToCanvas(args.qrUrl, QR_SIZE);
  const qrX = Math.floor((BADGE_WIDTH - QR_SIZE) / 2);
  ctx.drawImage(qrCanvas, qrX, layout.qr.y, QR_SIZE, QR_SIZE);
}
