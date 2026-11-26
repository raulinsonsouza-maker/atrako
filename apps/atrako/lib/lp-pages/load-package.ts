import fs from "fs";
import path from "path";
import type { LpPageMeta, LpPagePackage } from "./types";

const ROOT = path.join(process.cwd(), "lp-pages");

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

export function listLpPageSlugs(cwd = process.cwd()): string[] {
  const root = lpPagesRoot(cwd);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(path.join(root, slug, "meta.json")));
}

/** Lê `lp-pages/{slug}/` (page.html, page.css, meta.json, assets/). */
export function loadLpPagePackage(slug: string, cwd = process.cwd()): LpPagePackage {
  const dir = path.join(lpPagesRoot(cwd), slug);
  if (!fs.existsSync(dir)) throw new Error(`Pacote LP não encontrado: ${dir}`);

  const metaPath = path.join(dir, "meta.json");
  const htmlPath = path.join(dir, "page.html");
  const cssPath = path.join(dir, "page.css");
  if (!fs.existsSync(metaPath) || !fs.existsSync(htmlPath)) {
    throw new Error(`Pacote ${slug} precisa de meta.json e page.html`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as LpPageMeta;
  if (!meta.productSlug || (meta.goal !== "sales" && meta.goal !== "leads")) {
    throw new Error(`meta.json inválido em ${slug}`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
  const assetsDir = path.join(dir, "assets");
  const assetFiles = walkFiles(assetsDir).map((rel) => ({
    absPath: path.join(assetsDir, rel),
    destName: flattenAssetName(slug, `assets/${rel.replace(/\\/g, "/")}`),
  }));

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

export { ROOT as LP_PAGES_ROOT_DEFAULT };
