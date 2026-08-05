import qrcode from "qrcode-generator";

export function renderQrSvg(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("QR content is required");
  const code = qrcode(0, "M");
  code.addData(value, "Byte");
  code.make();
  return code.createSvgTag({
    cellSize: 4,
    margin: 16,
    scalable: true,
    title: "Scan to add this hosted map to ATAK",
    alt: "QR code containing an ATAK import link"
  });
}
