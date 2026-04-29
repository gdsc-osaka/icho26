/**
 * Absolute layout of the LX-D02 staff badge. The Y coordinates are the
 * top of each text row (not the baseline) so they match the design doc.
 */

export const BADGE_WIDTH = 384;
export const BADGE_HEIGHT = 600;

export const BADGE_LAYOUT = {
  name: {
    centerX: 192,
    topY: 136,
    /** Pixel font size cascade for auto-shrink when the name overflows. */
    fontSizes: [28, 24, 20] as const,
    /** Inner side padding (per side) used to bound the name's max width. */
    horizontalPadding: 12,
  },
  qr: {
    centerX: 192,
    centerY: 324,
    /** Maximum side length (px) for the rendered QR (modules + quiet zone). */
    maxSize: 232,
  },
  groupSize: {
    centerX: 60,
    topY: 492,
  },
  issuedAt: {
    leftX: 126,
    topY: 492,
  },
  groupId: {
    leftX: 48,
    topY: 548,
  },
} as const;
