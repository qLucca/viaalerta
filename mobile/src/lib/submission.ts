type Result = {
  error?: {
    code?: string;
    statusCode?: string | number;
    error?: string;
  } | null;
};

export async function persistOnce(store: {
  exists: () => Promise<boolean>;
  upload: () => Promise<Result>;
  insert: () => Promise<Result>;
}) {
  if (await store.exists()) return;
  const uploaded = await store.upload();
  if (
    uploaded.error &&
    String(uploaded.error.statusCode) !== "409" &&
    uploaded.error.error !== "Duplicate"
  )
    throw new Error("Não foi possível enviar a fotografia. Tente novamente.");
  try {
    const result = await store.insert();
    if (!result.error) return;
  } catch {
    // O servidor pode ter confirmado a transação antes de a conexão cair.
  }
  if (await store.exists()) return;
  // Preservar o objeto permite repetir o mesmo envio sem perder a foto.
  throw new Error(
    "Não foi possível confirmar o registro. Tente novamente; o mesmo envio será conferido antes de salvar.",
  );
}
