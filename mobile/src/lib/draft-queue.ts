import { z } from "zod";
import type { Photo, Point } from "../types";
import { problemTypes, type ProblemType } from "./registration.ts";

const schema = z.object({
  id: z.string().uuid(),
  owner: z.string().min(1).max(80),
  photo: z.object({
    uri: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    size: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
    name: z.string(),
    mime: z.literal("image/jpeg"),
  }),
  point: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
  description: z.string().max(1000),
  problem_type: z
    .enum(Object.keys(problemTypes) as [ProblemType, ...ProblemType[]])
    .default("buraco"),
  immediate_danger: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type OfflineDraft = z.infer<typeof schema>;
type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};
type Files = {
  copy: (photo: Photo, id: string, owner: string) => Promise<string>;
  remove: (uri: string) => Promise<void>;
};

export function draftQueue(storage: Storage, files: Files) {
  const locks = new Map<string, Promise<unknown>>();
  function key(owner: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(owner))
      throw new Error("Identificação da conta inválida.");
    return `viaalerta-offline-v1:${owner}`;
  }
  async function list(owner: string): Promise<OfflineDraft[]> {
    const saved = await storage.getItem(key(owner));
    if (!saved) return [];
    try {
      const rows = z.array(schema).max(20).parse(JSON.parse(saved));
      if (
        rows.some((row) => row.owner !== owner) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        throw new Error();
      return rows;
    } catch {
      throw new Error(
        "Não foi possível ler os rascunhos locais. Eles foram preservados para recuperação.",
      );
    }
  }
  function locked<T>(owner: string, action: () => Promise<T>) {
    const token = key(owner),
      previous = locks.get(token) || Promise.resolve();
    const current = previous.catch(() => {}).then(action);
    locks.set(token, current);
    return current.finally(() => {
      if (locks.get(token) === current) locks.delete(token);
    });
  }
  async function add(
    owner: string,
    id: string,
    photo: Photo,
    point: Point,
    description: string,
    options: { type?: ProblemType; danger?: boolean } = {},
  ) {
    const input = schema.parse({
      id,
      owner,
      photo,
      point,
      description,
      problem_type: options.type || "buraco",
      immediate_danger: options.danger || false,
      created_at: new Date().toISOString(),
    });
    return locked(owner, async () => {
      const rows = await list(owner),
        existing = rows.find((row) => row.id === id);
      if (existing) return existing;
      if (
        rows.length >= 20 ||
        rows.reduce((sum, row) => sum + row.photo.size, 0) + photo.size >
          80 * 1024 * 1024
      )
        throw new Error(
          "Limite local atingido. Envie ou remova rascunhos antes de guardar outro.",
        );
      const uri = await files.copy(photo, id, owner);
      const saved = { ...input, photo: { ...photo, uri } };
      try {
        await storage.setItem(key(owner), JSON.stringify([...rows, saved]));
      } catch {
        await files.remove(uri).catch(() => {});
        throw new Error(
          "Espaço ou armazenamento indisponível. O rascunho não foi guardado.",
        );
      }
      return saved;
    });
  }
  async function remove(owner: string, id: string) {
    return locked(owner, async () => {
      const rows = await list(owner),
        item = rows.find((row) => row.id === id);
      if (!item) return;
      await storage.setItem(
        key(owner),
        JSON.stringify(rows.filter((row) => row.id !== id)),
      );
      await files.remove(item.photo.uri).catch(() => {});
    });
  }
  return { list, add, remove };
}
