import QRCode from "qrcode";

export async function renderQrToCanvas(
  text: string,
  size: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  return canvas;
}
