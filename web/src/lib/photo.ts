import type { MapPoint } from "./location.ts";

export const INPUT_PHOTO_LIMIT = 25 * 1024 * 1024;
export function validateSourcePhoto(file: File) {
  if (!file.size) throw new Error("A imagem está vazia. Escolha outra foto.");
  if (file.size > INPUT_PHOTO_LIMIT)
    throw new Error(
      "Escolha uma foto com até 25 MB. Ela será reduzida antes do envio.",
    );
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Escolha uma foto JPG, PNG ou WebP. Para HEIC, exporte uma cópia em JPG no dispositivo.",
    );
}
export function resizedDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 40_000_000
  )
    throw new Error("Use uma foto válida com até 40 megapixels.");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
// O GPS do EXIF é apenas uma sugestão. A cópia enviada é redesenhada, sem esses metadados.
function readGps(v: DataView, base: number, end: number): MapPoint | undefined {
  if (
    base + 6 <= end &&
    v.getUint32(base) === 0x45786966 &&
    v.getUint16(base + 4) === 0
  )
    base += 6;
  const le = v.getUint16(base) === 0x4949;
  if (!le && v.getUint16(base) !== 0x4d4d) return;
  const u16 = (p: number) => v.getUint16(p, le),
    u32 = (p: number) => v.getUint32(p, le);
  if (u16(base + 2) !== 42) return;
  const entries = (relative: number) => {
    const start = base + relative,
      count = u16(start);
    if (start < base || start + 2 + 12 * count > end) throw new Error();
    return Array.from({ length: count }, (_, i) => start + 2 + 12 * i);
  };
  const gpsEntry = entries(u32(base + 4)).find((p) => u16(p) === 0x8825);
  if (gpsEntry === undefined) return;
  const gps = entries(u32(gpsEntry + 8));
  const ref = (tag: number) => {
    const p = gps.find((p) => u16(p) === tag);
    return p === undefined ? "" : String.fromCharCode(v.getUint8(p + 8));
  };
  const angle = (tag: number) => {
    const p = gps.find((p) => u16(p) === tag);
    if (p === undefined || u16(p + 2) !== 5 || u32(p + 4) !== 3)
      throw new Error();
    const at = base + u32(p + 8);
    if (at < base || at + 24 > end) throw new Error();
    const parts = [0, 1, 2].map((i) => {
      const n = u32(at + i * 8),
        d = u32(at + i * 8 + 4);
      if (!d) throw new Error();
      return n / d;
    });
    if (parts[1] >= 60 || parts[2] >= 60) throw new Error();
    return parts[0] + parts[1] / 60 + parts[2] / 3600;
  };
  const latRef = ref(1),
    lonRef = ref(3);
  if (!["N", "S"].includes(latRef) || !["E", "W"].includes(lonRef)) return;
  const lat = angle(2) * (latRef === "S" ? -1 : 1),
    lon = angle(4) * (lonRef === "W" ? -1 : 1);
  if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lat, lon];
  return;
}
export function photoGps(
  buffer: ArrayBuffer,
  type: string,
): MapPoint | undefined {
  try {
    const v = new DataView(buffer);
    if (type === "image/jpeg" && v.getUint16(0) === 0xffd8) {
      let at = 2;
      while (at + 4 < v.byteLength) {
        const marker = v.getUint16(at);
        at += 2;
        if (marker === 0xffda || marker === 0xffd9) return;
        if (marker >= 0xffd0 && marker <= 0xffd7) continue;
        const size = v.getUint16(at);
        if (size < 2 || at + size > v.byteLength) return;
        if (marker === 0xffe1 && v.getUint32(at + 2) === 0x45786966)
          return readGps(v, at + 2, at + size);
        at += size;
      }
    } else if (
      type === "image/png" &&
      v.getUint32(0) === 0x89504e47 &&
      v.getUint32(4) === 0x0d0a1a0a
    ) {
      let at = 8;
      while (at + 12 <= v.byteLength) {
        const size = v.getUint32(at),
          end = at + 8 + size;
        if (end + 4 > v.byteLength) return;
        if (v.getUint32(at + 4) === 0x65584966) return readGps(v, at + 8, end);
        at = end + 4;
      }
    } else if (
      type === "image/webp" &&
      v.getUint32(0) === 0x52494646 &&
      v.getUint32(8) === 0x57454250
    ) {
      let at = 12;
      while (at + 8 <= v.byteLength) {
        const size = v.getUint32(at + 4, true),
          end = at + 8 + size;
        if (end > v.byteLength) return;
        if (v.getUint32(at) === 0x45584946) return readGps(v, at + 8, end);
        at = end + (size % 2);
      }
    }
  } catch {
    return;
  }
}
export function jpegGps(buffer: ArrayBuffer) {
  return photoGps(buffer, "image/jpeg");
}
export async function preparePhoto(source: File) {
  validateSourcePhoto(source);
  const gps = photoGps(await source.arrayBuffer(), source.type);
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(source);
  } catch {
    throw new Error(
      "Não foi possível abrir esta foto. Escolha outro JPG, PNG ou WebP.",
    );
  }
  try {
    const dimensions = resizedDimensions(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Seu navegador não conseguiu preparar a foto.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("Não foi possível reduzir a foto.")),
        "image/jpeg",
        0.82,
      ),
    );
    if (blob.size > 8 * 1024 * 1024)
      throw new Error(
        "A foto ainda ficou grande demais. Escolha outra imagem.",
      );
    return {
      file: new File([blob], "registro.jpg", { type: "image/jpeg" }),
      gps,
      ...dimensions,
    };
  } finally {
    image.close();
  }
}
