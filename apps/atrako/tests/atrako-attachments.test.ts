import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { excerptFromFile } from "../lib/atrako-agent/attachment-text";
import {
  attachmentDigest,
  attachmentOwnedBy,
  attachmentTooBig,
  imagesForBrief,
  kindFromFile,
  plainTextExcerpt,
  sanitizeAttachments,
} from "../lib/atrako-agent/attachments";
import { assessLpBrief } from "../lib/criar/lp-brief";
import { buildSalesPageV3 } from "../lib/criar/lp-html";

const WS = "ws1";

describe("anexos", () => {
  it("extrai texto simples e recusa tipo ou tamanho", async () => {
    const text = await excerptFromFile(Buffer.from("Oferta de fotografia para iniciantes"), "text/plain", "oferta.txt");
    assert.match(plainTextExcerpt(Buffer.from("Oferta de fotografia")), /Oferta/);
    assert.match(text, /Oferta de fotografia/);
    assert.equal(kindFromFile("application/zip", "virus.zip"), null);
    assert.equal(attachmentTooBig("image", 5 * 1024 * 1024 + 1), true);
    assert.equal(attachmentTooBig("document", 8 * 1024 * 1024), false);
    assert.equal(attachmentTooBig("video", 25 * 1024 * 1024 + 1), true);
  });

  it("o bloco só leva URL de upload deste workspace", () => {
    const items = sanitizeAttachments(
      [
        { id: "1", name: "golpe.txt", kind: "document", mime: "text/plain", url: "https://evil.example/a.txt", text: "segredo" },
        { id: "2", name: "oferta.txt", kind: "document", mime: "text/plain", url: `/lp-media/${WS}_1.txt`, text: "oferta real" },
        { id: "3", name: "foto.jpg", kind: "image", mime: "image/jpeg", url: `https://blob.example/lp/${WS}/foto.jpg` },
      ],
      WS,
    );
    const block = attachmentDigest(items);
    assert.match(block, /\[Anexos\]/);
    assert.match(block, /oferta real/);
    assert.match(block, /foto\.jpg/);
    assert.doesNotMatch(block, /evil\.example/);
    assert.doesNotMatch(block, /segredo/);
    assert.equal(attachmentOwnedBy("https://blob.example/lp/outro/foto.jpg", WS), false);
  });

  it("a foto da pessoa fica no hero, na frente do banco", () => {
    const lines = imagesForBrief(
      [{ url: `https://blob.example/lp/${WS}/fachada.jpg`, name: "fachada.jpg" }],
      [{ rotulo: "IMG1", url: "https://images.unsplash.com/photo-1", alt: "clínica", papel: "hero, paisagem" }],
    );
    assert.equal(lines[0].url, `https://blob.example/lp/${WS}/fachada.jpg`);
    assert.equal(lines[0].papel, "hero");
    assert.equal(lines[1].papel, "seção");
    assert.match(lines[1].url, /unsplash/);
  });

  it("mantém o vídeo enviado e remove o de outra origem", () => {
    const mine = "https://blob.example/lp/ws1/clip.mp4";
    const page = buildSalesPageV3({
      goal: "leads",
      brief: "página",
      videoUrls: [mine],
      html: `<section><video src="https://evil.example/x.mp4" autoplay controls></video><video controls autoplay><source src="${mine}" type="video/mp4"></video></section>`,
    });
    assert.doesNotMatch(page.html, /evil\.example/);
    assert.match(page.html, /clip\.mp4/);
    assert.doesNotMatch(page.html, /autoplay/i);
    const blocked = buildSalesPageV3({
      goal: "leads",
      brief: "página",
      html: `<video controls><source src="${mine}" type="video/mp4"></video>`,
    });
    assert.doesNotMatch(blocked.html, /clip\.mp4/);
  });

  it("arquivo não confirma o plano, e o plano cita o nome", () => {
    const base = {
      briefing: "Curso de fotografia para quem quer vender pelo celular",
      publico: "iniciantes",
      estilo: "claro e simples",
      cta: "Quero participar",
      goal: "leads" as const,
      precoReais: null,
      temProduto: false,
      anexos: ["fachada.jpg"],
    };
    const arquivo = assessLpBrief({ ...base, lastUserMessage: "Segue o arquivo." });
    assert.equal(arquivo.ok, false);
    if (!arquivo.ok) assert.match(arquivo.falar, /fachada\.jpg/);
    const pode = assessLpBrief({ ...base, lastUserMessage: "pode montar" });
    assert.equal(pode.ok, true);
  });
});
