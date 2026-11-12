export function gpsFixture() {
  const buffer = new ArrayBuffer(142),
    v = new DataView(buffer),
    base = 12;
  v.setUint16(0, 0xffd8);
  v.setUint16(2, 0xffe1);
  v.setUint16(4, 136);
  v.setUint32(6, 0x45786966);
  v.setUint16(base, 0x4949);
  v.setUint16(base + 2, 42, true);
  v.setUint32(base + 4, 8, true);
  v.setUint16(base + 8, 1, true);
  const e = base + 10;
  v.setUint16(e, 0x8825, true);
  v.setUint16(e + 2, 4, true);
  v.setUint32(e + 4, 1, true);
  v.setUint32(e + 8, 26, true);
  v.setUint16(base + 26, 4, true);
  for (let i = 0; i < 4; i++) {
    const p = base + 28 + i * 12;
    v.setUint16(p, i + 1, true);
    v.setUint16(p + 2, i % 2 ? 5 : 2, true);
    v.setUint32(p + 4, i % 2 ? 3 : 2, true);
    if (i % 2) v.setUint32(p + 8, i === 1 ? 80 : 104, true);
    else v.setUint8(p + 8, i === 0 ? 83 : 87);
  }
  for (const [at, parts] of [
    [80, [18, 52, 55]],
    [104, [48, 15, 18]],
  ])
    parts.forEach((n, i) => {
      v.setUint32(base + at + i * 8, n, true);
      v.setUint32(base + at + i * 8 + 4, 1, true);
    });
  v.setUint16(140, 0xffd9);
  return buffer;
}
