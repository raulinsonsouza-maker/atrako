import fs from "fs";
import path from "path";
import type { LpPageMeta, LpPagePackage } from "./types";

function isSafeFlatName(name: string) {
  return /^[A-Za-z0-9_-]{1,160}\.(png|jpe?g|webp|gif|svg|mp4|webm)$/i.test(name);
}

function flattenAssetName(slug: string, relativePath: string) {
  const base = relativePath.replace(/\\/g, "/").replace(/^assets\//, "").replace(/\//g, "-");
  const dest = `${slug}-${base}`.replace(/[^A-Za-z0-9._-]/g, "-");
  if (!isSafeFlatName(dest)) {
    throw new Error(`Nome de asset inválido após flatten: ${dest} (de ${relativePath})`);
  }
  return dest;
}

function walkFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(abs, base));
    else out.push(path.relative(base, abs));
  }
  return out;
}

export function lpPagesRoot(cwd = process.cwd()) {
  return path.join(cwd, "lp-pages");
}

/**
 * Resolve pasta do pacote.
 * Aceita: `pikolin-mood` | `stresser/pikolin-mood` | path relativo sob lp-pages/
 * Ignora `_template` como pacote publicável (é só modelo).
 */
export function resolveLpPageDir(packageId: string, cwd = process.cwd()): string {
  const root = lpPagesRoot(cwd);
  const id = packageId.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!id || id.includes("..") || id.startsWith("_")) {
    throw new Error(`Pacote inválido: ${packageId}`);
  }
  const candidates = [
    path.join(root, id),
    path.join(root, id.split("/").pop()!),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta.json")) && fs.existsSync(path.join(dir, "page.html"))) {
      return dir;
    }
  }
  throw new Error(`Pacote LP não encontrado: ${packageId} (em ${root})`);
}

/** Lista ids publicáveis: `slug` ou `workspace/slug`. */
export function listLpPageSlugs(cwd = process.cwd()): string[] {
  const root = lpPagesRoot(cwd);
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const abs = path.join(root, entry.name);
    if (fs.existsSync(path.join(abs, "meta.json"))) {
      out.push(entry.name);
      continue;
    }
    // workspace/slug
    for (const child of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!child.isDirectory() || child.name.startsWith("_") || child.name.startsWith(".")) continue;
      const childAbs = path.join(abs, child.name);
      if (fs.existsSync(path.join(childAbs, "meta.json"))) {
        out.push(`${entry.name}/${child.name}`);
      }
    }
  }
  return out.sort();
}

/** Lê pacote Pages (qualquer cliente). */
export function loadLpPagePackage(packageId: string, cwd = process.cwd()): LpPagePackage {
  const dir = resolveLpPageDir(packageId, cwd);
  const metaPath = path.join(dir, "meta.json");
  const htmlPath = path.join(dir, "page.html");
  const cssPath = path.join(dir, "page.css");

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as LpPageMeta;
  if (!meta.productSlug || (meta.goal !== "sales" && meta.goal !== "leads")) {
    throw new Error(`meta.json inválido em ${packageId}`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
  const assetsDir = path.join(dir, "assets");
  const flatSlug = (meta.workspaceSlug ? `${meta.workspaceSlug}-` : "") + meta.productSlug;
  const assetFiles = walkFiles(assetsDir).map((rel) => ({
    absPath: path.join(assetsDir, rel),
    destName: flattenAssetName(flatSlug, `assets/${rel.replace(/\\/g, "/")}`),
  }));

  const slug = path.relative(lpPagesRoot(cwd), dir).replace(/\\/g, "/");
  return { slug, dir, meta, html, css, assetFiles };
}

/** Troca `assets/…` locais por URLs `/lp-media/{flat}` no HTML/CSS. */
export function rewriteAssetUrls(pkg: LpPagePackage, html: string, css: string) {
  let nextHtml = html;
  let nextCss = css;
  for (const file of pkg.assetFiles) {
    const originalRel = file.absPath
      .slice(path.join(pkg.dir, "assets").length)
      .replace(/\\/g, "/")
      .replace(/^\//, "");
    const localPatterns = [
      `assets/${originalRel}`,
      `./assets/${originalRel}`,
      `/assets/${originalRel}`,
    ];
    const publicUrl = `/lp-media/${file.destName}`;
    for (const p of localPatterns) {
      nextHtml = nextHtml.split(p).join(publicUrl);
      nextCss = nextCss.split(p).join(publicUrl);
    }
  }
  return { html: nextHtml, css: nextCss };
}
