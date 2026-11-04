import { z } from "zod";
import type { Analysis } from "../types";
const schema = z.object({
  image_width: z.number().int().positive(),
  image_height: z.number().int().positive(),
  detections: z.array(
    z.object({
      class_id: z.number().int().nonnegative(),
      class_name: z.string(),
      confidence: z.number().min(0).max(1),
      bbox: z.tuple([
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
      ]),
    }),
  ),
});
export function parseAnalysis(
  value: unknown,
  width: number,
  height: number,
): Analysis {
  const result = schema.parse(value);
  if (result.image_width !== width || result.image_height !== height)
    throw new Error("A API retornou dimensões diferentes da imagem enviada.");
  for (const {
    bbox: [x1, y1, x2, y2],
  } of result.detections)
    if (x2 <= x1 || y2 <= y1 || x2 > width || y2 > height)
      throw new Error("A API retornou caixas fora dos limites da imagem.");
  return { ...result, simulated: false };
}
export function simulatedAnalysis(
  width: number,
  height: number,
  empty = false,
): Analysis {
  return {
    image_width: width,
    image_height: height,
    simulated: true,
    detections: empty
      ? []
      : [
          {
            class_id: 0,
            class_name: "buraco",
            confidence: 0.94,
            bbox: [width * 0.24, height * 0.38, width * 0.72, height * 0.78],
          },
        ],
  };
}
export function assertPhoto(size: number, width: number, height: number) {
  if (!Number.isFinite(size) || size <= 0 || size > 8 * 1024 * 1024)
    throw new Error("Use uma foto com até 8 MB.");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 40_000_000
  )
    throw new Error("Use uma foto com até 40 megapixels.");
}
