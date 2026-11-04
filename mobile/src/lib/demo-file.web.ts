export async function persistDemoPhoto(uri: string, _id: string) {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Não foi possível guardar a foto local."));
    reader.readAsDataURL(blob);
  });
}
