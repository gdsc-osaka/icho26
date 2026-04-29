export const BADGE_WIDTH = 384;

export type LayoutInput = {
  companyNameHeight: number;
  groupNameHeight: number;
  groupSizeHeight: number;
  qrSize: number;
  paddingTop?: number;
  paddingBottom?: number;
  gap?: number;
};

export type Section = { y: number; height: number };

export type BadgeLayout = {
  totalHeight: number;
  companyName: Section;
  groupName: Section;
  groupSize: Section;
  qr: Section;
};

export function planBadge(input: LayoutInput): BadgeLayout {
  const paddingTop = input.paddingTop ?? 16;
  const paddingBottom = input.paddingBottom ?? 24;
  const gap = input.gap ?? 12;

  let cursor = paddingTop;
  const companyName: Section = { y: cursor, height: input.companyNameHeight };
  cursor += input.companyNameHeight + gap;
  const groupName: Section = { y: cursor, height: input.groupNameHeight };
  cursor += input.groupNameHeight + gap;
  const groupSize: Section = { y: cursor, height: input.groupSizeHeight };
  cursor += input.groupSizeHeight + gap;
  const qr: Section = { y: cursor, height: input.qrSize };
  cursor += input.qrSize + paddingBottom;

  return {
    totalHeight: cursor,
    companyName,
    groupName,
    groupSize,
    qr,
  };
}
