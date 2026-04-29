import type { Bitmap } from "bdfparser";
import QRCode from "qrcode";
import { BADGE_HEIGHT, BADGE_LAYOUT, BADGE_WIDTH } from "./badge-layout";
import { loadBackground } from "./background";
import { loadFontDateTime, loadFontUuidex } from "./bdf-font";
import { ensureNotoSansJp } from "./web-font";

export type BadgeArgs = {
  groupName: string;
  groupSize: number;
  groupId: string;
  issuedAt: Date;
  qrUrl: string;
};

export function formatYmdHms(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function drawBitmapTopLeft(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  scale: number,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  bitmap.draw2canvas(ctx, { "0": null, "1": "#000000", "2": "#000000" });
  ctx.restore();
}

function drawBitmapAtCenterX(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  scale: number,
  centerX: number,
  topY: number,
) {
  const width = bitmap.width() * scale;
  const x = Math.floor(centerX - width / 2);
  drawBitmapTopLeft(ctx, bitmap, scale, x, topY);
}

function drawNameWithAutoShrink(
  ctx: CanvasRenderingContext2D,
  name: string,
  centerX: number,
  topY: number,
  fontSizes: readonly number[],
  maxWidth: number,
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";
  let chosen = fontSizes.at(-1) ?? 20;
  for (const size of fontSizes) {
    ctx.font = `500 ${size}px "Noto Sans JP", sans-serif`;
    if (ctx.measureText(name).width <= maxWidth) {
      chosen = size;
      break;
    }
  }
  ctx.font = `500 ${chosen}px "Noto Sans JP", sans-serif`;
  ctx.fillText(name, centerX, topY);
}

async function renderQrAtCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  maxSize: number,
) {
  // Determine the module count via QRCode.create so we can pick an
  // integer pixel scale that fits within `maxSize` (modules + 2 *
  // margin).
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const margin = 1;
  const totalModules = qr.modules.size + margin * 2;
  const scale = Math.max(1, Math.floor(maxSize / totalModules));

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text, {
    errorCorrectionLevel: "M",
    margin,
    scale,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const size = qrCanvas.width;
  // Centering an integer-sized square on an integer center coordinate
  // can leave a 0.5 px residue when size is odd; rounding the top-left
  // accepts a 1 px shift in that case (per the layout spec).
  const x = Math.floor(centerX - size / 2);
  const y = Math.floor(centerY - size / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, x, y);
}

export async function renderBadgeToCanvas(
  canvas: HTMLCanvasElement,
  args: BadgeArgs,
): Promise<void> {
  const [background, fontUuidex, fontDateTime] = await Promise.all([
    loadBackground(),
    loadFontUuidex(),
    loadFontDateTime(),
    ensureNotoSansJp(),
  ]);

  canvas.width = BADGE_WIDTH;
  canvas.height = BADGE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context for badge canvas");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(background, 0, 0, BADGE_WIDTH, BADGE_HEIGHT);

  drawNameWithAutoShrink(
    ctx,
    args.groupName,
    BADGE_LAYOUT.name.centerX,
    BADGE_LAYOUT.name.topY,
    BADGE_LAYOUT.name.fontSizes,
    BADGE_WIDTH - BADGE_LAYOUT.name.horizontalPadding * 2,
  );

  await renderQrAtCenter(
    ctx,
    args.qrUrl,
    BADGE_LAYOUT.qr.centerX,
    BADGE_LAYOUT.qr.centerY,
    BADGE_LAYOUT.qr.maxSize,
  );

  drawBitmapAtCenterX(
    ctx,
    fontDateTime.draw(String(args.groupSize)),
    1,
    BADGE_LAYOUT.groupSize.centerX,
    BADGE_LAYOUT.groupSize.topY,
  );

  drawBitmapTopLeft(
    ctx,
    fontDateTime.draw(formatYmdHms(args.issuedAt)),
    1,
    BADGE_LAYOUT.issuedAt.leftX,
    BADGE_LAYOUT.issuedAt.topY,
  );

  drawBitmapTopLeft(
    ctx,
    fontUuidex.draw(args.groupId),
    1,
    BADGE_LAYOUT.groupId.leftX,
    BADGE_LAYOUT.groupId.topY,
  );
}
