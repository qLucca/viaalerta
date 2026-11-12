import { z } from "zod";
import type { Analysis } from "@/types";
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
  const data = schema.parse(value);
  if (data.image_width !== width || data.image_height !== height)
    throw new Error(
      "A API retornou dimensões diferentes da fotografia original.",
    );
  for (const {
    bbox: [x1, y1, x2, y2],
  } of data.detections)
    if (x2 <= x1 || y2 <= y1 || x2 > width || y2 > height)
      throw new Error("A API retornou coordenadas inválidas.");
  return { ...data, simulated: false };
}
