import type { Bounds, Occurrence, Point } from "../types";
export type MapProps = {
  records?: Occurrence[];
  point?: Point;
  focus?: Point;
  picking?: boolean;
  onPoint?: (point: Point) => void;
  onBounds?: (bounds: Bounds) => void;
  onSelect?: (id: string) => void;
};
export function handleMapMessage(raw: unknown, props: MapProps) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data?.source !== "viaalerta-map") return;
    const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
    if (
      data.type === "point" &&
      props.picking &&
      Array.isArray(data.point) &&
      data.point.length === 2 &&
      data.point.every(finite) &&
      Math.abs(data.point[0]) <= 90 &&
      Math.abs(data.point[1]) <= 180
    )
      props.onPoint?.(data.point);
    if (data.type === "select" && props.records?.some((r) => r.id === data.id))
      props.onSelect?.(data.id);
    if (data.type === "bounds") {
      const b = data.bounds;
      if (
        b &&
        [b.south, b.west, b.north, b.east].every(finite) &&
        b.south <= b.north &&
        b.west <= b.east
      )
        props.onBounds?.(b);
    }
  } catch {
  }
}
export function mapPayload(props: MapProps, dark: boolean) {
  return {
    dark,
    picking: !!props.picking,
    point: props.point,
    focus: props.focus,
    records: (props.records || []).map((r) => ({
      id: r.id,
      latitude: r.latitude,
      longitude: r.longitude,
      status: r.status,
      description: r.description,
    })),
  };
}
