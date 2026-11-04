type SecureAdapter = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
type Index = { version: string; count: number };
function parseIndex(raw: string): Index {
  const value = JSON.parse(raw);
  if (
    typeof value.version !== "string" ||
    !/^[a-zA-Z0-9-]+$/.test(value.version) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 128
  )
    throw new Error("Sessão local inválida.");
  return value;
}
function readIndex(raw: string): Index | null {
  try {
    return parseIndex(raw);
  } catch {
    return null;
  }
}
export function secureSession(adapter: SecureAdapter) {
  async function cleanup(key: string, index: Index) {
    await Promise.all(
      Array.from({ length: index.count }, (_, i) =>
        adapter.deleteItemAsync(`${key}.${index.version}.${i}`),
      ),
    );
  }
  return {
    async getItem(key: string) {
      const raw = await adapter.getItemAsync(key);
      if (!raw) return null;
      const index = readIndex(raw);
      if (!index) return null;
      const values = await Promise.all(
        Array.from({ length: index.count }, (_, i) =>
          adapter.getItemAsync(`${key}.${index.version}.${i}`),
        ),
      );
      return values.some((x) => x === null) ? null : values.join("");
    },
    async setItem(key: string, value: string) {
      const count = Math.ceil(value.length / 500);
      if (count < 1 || count > 128)
        throw new Error("A sessão excede o limite de armazenamento seguro.");
      const previous = await adapter.getItemAsync(key);
      const index = {
        version: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        count,
      };
      try {
        for (let i = 0; i < count; i++)
          await adapter.setItemAsync(
            `${key}.${index.version}.${i}`,
            value.slice(i * 500, (i + 1) * 500),
          );
        await adapter.setItemAsync(key, JSON.stringify(index));
      } catch (error) {
        await cleanup(key, index).catch(() => {});
        throw error;
      }
      const previousIndex = previous ? readIndex(previous) : null;
      if (previousIndex) await cleanup(key, previousIndex).catch(() => {});
    },
    async removeItem(key: string) {
      const raw = await adapter.getItemAsync(key);
      await adapter.deleteItemAsync(key);
      const index = raw ? readIndex(raw) : null;
      if (index) await cleanup(key, index);
    },
  };
}
