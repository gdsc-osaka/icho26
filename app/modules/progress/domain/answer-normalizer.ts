export function normalizeAnswer(input: string): string {
  let s = input.trim();
  s = toHalfWidthAlnum(s);
  s = s.toLowerCase();
  s = stripLeadingZerosIfInteger(s);
  return s;
}

function toHalfWidthAlnum(input: string): string {
  return input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

function stripLeadingZerosIfInteger(input: string): string {
  if (!/^\d+$/.test(input)) return input;
  const trimmed = input.replace(/^0+/, "");
  return trimmed === "" ? "0" : trimmed;
}
