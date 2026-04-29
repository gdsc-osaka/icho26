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

/**
 * Per-glyph advance (DWIDTH) of the b24-datetime BDF subset. All glyphs
 * use the same value, so we treat it as a font-level monospace constant.
 */
const B24_DATETIME_DWX = 12;

/**
 * Center a bdfparser bitmap horizontally using the *ink* width instead
 * of `bitmap.width()`.
 *
 * Why we do not just use `bitmap.width()`:
 * `font.draw(str)` defaults to `mode=1`, which renders each glyph into
 * the FONT bounding box (FBBX, 24 px for b24-datetime) and concatenates
 * them with offset = `dwx0 - fbbx` = `12 - 24 = -12`. The result for an
 * n-character monospaced string is therefore
 *
 *   bitmap.width() = FBBX + (n - 1) * dwx0 = 24 + 12 * (n - 1)
 *
 * which has 12 px (== one full character) of trailing whitespace past
 * the rightmost ink column. Centering on `bitmap.width() / 2` shifts
 * the visible digits ~6 px to the left of the requested center — most
 * obvious for the 2-digit party size at x=60.
 *
 * mode=0 is worse (each FBBX cell is concatenated with offset=0, so the
 * digits end up with a 12 px *gap* between them), `usecurrentglyphspacing`
 * just toggles which offset entry is dropped (no effect on width), and
 * `glyph.draw(1)` (BBX-only) is not exposed through `font.draw`. So the
 * pragmatic fix is to compute the ink width from `text.length * dwx0`
 * for the known-monospace BDF subsets we ship, ignoring the 12 px tail.
 *
 * Investigated against bdfparser 2.2.5 (`drawcps` in
 * node_modules/bdfparser/dist/esm/bdfparser.js).
 */
function drawMonoTextCenteredX(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  scale: number,
  text: string,
  monoDwx: number,
  centerX: number,
  topY: number,
) {
  const inkWidth = text.length * monoDwx * scale;
  const x = Math.floor(centerX - inkWidth / 2);
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

  const groupSizeText = String(args.groupSize);
  drawMonoTextCenteredX(
    ctx,
    fontDateTime.draw(groupSizeText),
    1,
    groupSizeText,
    B24_DATETIME_DWX,
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
