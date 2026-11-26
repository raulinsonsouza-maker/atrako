import { loadLpPagePackage, rewriteAssetUrls } from "../lib/lp-pages/load-package";
import { buildSalesPageV3, MAX_LP_CSS, MAX_LP_HTML } from "../lib/criar/lp-html";
import { renderSlots } from "../lib/criar/lp-v3";

const pkg = loadLpPagePackage("stresser/pikolin-mood");
const r = rewriteAssetUrls(pkg, pkg.html, pkg.css);
const page = buildSalesPageV3({
  goal: pkg.meta.goal,
  html: r.html,
  css: r.css,
  fonts: pkg.meta.fonts,
  theme: pkg.meta.theme,
  brief: pkg.meta.brief || "x",
  videoUrls: pkg.meta.videoUrls || [],
  generatedBy: "lp-pages-publish",
});
const out = renderSlots(page.html);
const report = {
  htmlBytes: Buffer.byteLength(page.html, "utf8"),
  cssBytes: Buffer.byteLength(page.css, "utf8"),
  underLimits:
    Buffer.byteLength(page.html, "utf8") <= MAX_LP_HTML &&
    Buffer.byteLength(page.css, "utf8") <= MAX_LP_CSS,
  gallery: out.includes('data-atrako-slot="gallery"'),
  layers: out.includes('data-atrako-slot="layers"'),
  checkout: out.includes('data-atrako-slot="checkout"'),
  sticky: out.includes("mood-sticky"),
  fonts: page.fonts,
};
console.log(JSON.stringify(report, null, 2));
if (!report.underLimits || !report.gallery || !report.layers || !report.checkout) {
  process.exit(2);
}
