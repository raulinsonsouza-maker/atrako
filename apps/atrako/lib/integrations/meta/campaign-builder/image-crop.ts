/**
 * Center-crop de imagem para aspect ratio alvo (1:1 ou 9:16) antes do upload Meta.
 */

export type AspectPreset = "1:1" | "9:16";

const ASPECT: Record<AspectPreset, { w: number; h: number }> = {
  "1:1": { w: 1, h: 1 },
  "9:16": { w: 9, h: 16 },
};

export async function cropImageToAspect(
  file: File,
  preset: AspectPreset,
  maxEdge = 1440,
): Promise<{ blob: Blob; filename: string }> {
  const { w: aw, h: ah } = ASPECT[preset];
  const targetRatio = aw / ah;

  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const srcRatio = srcW / srcH;

  let cropW: number;
  let cropH: number;
  let sx: number;
  let sy: number;

  if (srcRatio > targetRatio) {
    // mais largo → corta laterais
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
    sx = Math.round((srcW - cropW) / 2);
    sy = 0;
  } else {
    // mais alto → corta topo/base
    cropW = srcW;
    cropH = Math.round(srcW / targetRatio);
    sx = 0;
    sy = Math.round((srcH - cropH) / 2);
  }

  let outW = cropW;
  let outH = cropH;
  const long = Math.max(outW, outH);
  if (long > maxEdge) {
    const scale = maxEdge / long;
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
      "image/jpeg",
      0.92,
    );
  });

  const base = file.name.replace(/\.[^.]+$/, "") || "creative";
  const suffix = preset === "1:1" ? "1x1" : "9x16";
  return { blob, filename: `${base}_${suffix}.jpg` };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
