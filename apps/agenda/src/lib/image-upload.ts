export const MAX_ENTITY_PHOTO_BYTES = 350_000;
export const MAX_SERVICE_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_COVER_BYTES = 2 * 1024 * 1024;

export function readEntityImageFile(
  file: File | null,
  onOk: (dataUrl: string) => void,
  onError: (msg: string) => void,
  maxBytes: number = MAX_ENTITY_PHOTO_BYTES,
) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    onError("Envie uma imagem (PNG, JPG ou WebP)");
    return;
  }
  if (file.size > maxBytes) {
    onError("Imagem muito grande");
    return;
  }
  void compressImageFile(file, {
    maxEdge: maxBytes > 500_000 ? 1400 : 800,
    targetBytes: Math.min(maxBytes, 450_000),
  })
    .then(onOk)
    .catch(() => {
      const reader = new FileReader();
      reader.onload = () => onOk(String(reader.result || ""));
      reader.onerror = () => onError("Não foi possível ler a imagem");
      reader.readAsDataURL(file);
    });
}

/** Comprime e redimensiona para caber no banco / JSON sem estourar o body. */
export function compressImageFile(
  file: File,
  opts: { maxEdge?: number; targetBytes?: number; quality?: number } = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 1400;
  const targetBytes = opts.targetBytes ?? 450_000;
  const startQuality = opts.quality ?? 0.84;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const src = String(reader.result || "");
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        let quality = startQuality;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        // Aproxima tamanho do data URL (base64 ~ 4/3)
        while (dataUrl.length * 0.75 > targetBytes && quality > 0.45) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
