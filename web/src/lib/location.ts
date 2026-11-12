export type MapPoint = [number, number];

function coordinate(
  value: string | undefined,
  fallback: number,
  limit: number,
) {
  const parsed = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit
    ? parsed
    : fallback;
}

export const DEFAULT_CITY = {
  name: process.env.NEXT_PUBLIC_DEFAULT_CITY_NAME?.trim() || "Uberlândia, MG",
  center: [
    coordinate(process.env.NEXT_PUBLIC_DEFAULT_CITY_LATITUDE, -18.9186, 90),
    coordinate(process.env.NEXT_PUBLIC_DEFAULT_CITY_LONGITUDE, -48.2772, 180),
  ] as MapPoint,
};

export function validMapPoints(
  records: { latitude: number; longitude: number }[],
): MapPoint[] {
  return records
    .filter(
      ({ latitude, longitude }) =>
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180,
    )
    .map(({ latitude, longitude }) => [latitude, longitude]);
}

// Consultar a permissão primeiro evita abrir um pedido de localização ao entrar na página.
export async function previouslyAllowedLocation(): Promise<
  MapPoint | undefined
> {
  if (!navigator.permissions || !navigator.geolocation) return;
  try {
    const permission = await navigator.permissions.query({
      name: "geolocation",
    });
    if (permission.state !== "granted") return;
    return await new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve([coords.latitude, coords.longitude]),
        () => resolve(undefined),
        { timeout: 6000, maximumAge: 60000 },
      ),
    );
  } catch {
    return;
  }
}
