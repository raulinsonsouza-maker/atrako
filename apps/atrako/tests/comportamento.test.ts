import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateComportamento, buyerKey, comportamentoRange, densifySerie, type BehaviorOrder } from "../lib/commerce/comportamento";
import { genderFromName } from "../lib/geo/gender";
import { normalizePlace } from "../lib/geo/place";

function order(partial: Partial<BehaviorOrder> & Pick<BehaviorOrder, "id">): BehaviorOrder {
  return {
    provider: "WOOCOMMERCE",
    status: "processing",
    totalCents: 10000,
    occurredAt: new Date("2026-10-07T15:00:00.000Z"),
    contactId: "c1",
    buyerName: "Maria Silva",
    buyerEmail: "maria@ex.com",
    stateUf: "RJ",
    cityName: "Rio de Janeiro",
    cityRaw: null,
    contactName: "Maria Silva",
    contactGender: "F",
    channel: "direct",
    items: [],
    ...partial,
  };
}

describe("lugar e gênero", () => {
  it("casa município do IBGE sem acento", () => {
    const place = normalizePlace("Sao Paulo", "SP");
    assert.equal(place.stateUf, "SP");
    assert.equal(place.cityName, "São Paulo");
    assert.equal(place.cityRaw, null);
  });

  it("guarda o texto quando a cidade não existe", () => {
    const place = normalizePlace("Bairro Novo", "RJ");
    assert.equal(place.stateUf, "RJ");
    assert.equal(place.cityName, null);
    assert.equal(place.cityRaw, "Bairro Novo");
  });

  it("estima gênero pelo primeiro nome e deixa ambíguo vazio", () => {
    assert.equal(genderFromName("Maria Eduarda"), "F");
    assert.equal(genderFromName("João Pedro"), "M");
    assert.equal(genderFromName("Letícia Souza"), "F");
    assert.equal(genderFromName("Nicole Schraiber"), "F");
    assert.equal(genderFromName("Nailú Nardi"), "F");
    assert.equal(genderFromName("Deisi Guacira Tibes"), "F");
    assert.equal(genderFromName("Alessandro Carvalho"), "M");
    assert.equal(genderFromName("Alex"), null);
    assert.equal(genderFromName("Cliente teste"), null);
    assert.equal(genderFromName("Edu Teste"), null);
    assert.equal(genderFromName(""), null);
  });
});

describe("comportamento", () => {
  it("separa primeira compra, recompra e origem", () => {
    const first = order({
      id: "a",
      occurredAt: new Date("2026-10-07T15:00:00.000Z"),
      totalCents: 10000,
      items: [{ title: "Óleo", sku: "OL1", quantity: 1, lineTotalCents: 10000 }],
    });
    const again = order({
      id: "b",
      occurredAt: new Date("2026-10-08T15:00:00.000Z"),
      totalCents: 20000,
      channel: "meta_ads",
      items: [{ title: "Cápsula", sku: "CP1", quantity: 2, lineTotalCents: 20000 }],
    });
    const anon = order({
      id: "c",
      contactId: null,
      buyerEmail: null,
      buyerName: null,
      contactName: null,
      contactGender: null,
      totalCents: 5000,
      stateUf: null,
      cityName: null,
    });
    const result = aggregateComportamento({
      current: [again, first, anon],
      previous: [],
      priorKeys: new Set([buyerKey(first)!]),
      lifetimeReceitaCents: 35000,
      lifetimeCompradores: 1,
    });

    assert.equal(result.recompra.pedidosRecompra, 2);
    assert.equal(result.recompra.pedidosPrimeira, 0);
    assert.equal(result.recompra.pedidosSemContato, 1);
    assert.equal(result.recompra.receitaRecompraCents, 30000);
    assert.equal(result.tickets.pedidoCents, Math.round(35000 / 3));
    assert.equal(result.tickets.porClienteCents, Math.round(35000 / 1));
    assert.equal(result.tickets.recompraCents, 15000);
    assert.equal(result.ltv.medioCents, 35000);
    assert.equal(result.origens.find((o) => o.id === "meta_ads")?.recompraPct, 100);
    assert.equal(result.pares.length, 0);
    assert.equal(result.genero.f.pedidos, 2);
    assert.equal(result.genero.u.pedidos, 1);
    assert.equal(result.estados[0]?.nome, "Rio de Janeiro");
    assert.equal(result.topCompradores[0]?.nome, "Maria Silva");
    assert.equal(result.topCompradores[0]?.compras.length, 2);

    const soMulheres = aggregateComportamento(
      {
        current: [again, first, anon],
        previous: [],
        priorKeys: new Set([buyerKey(first)!]),
        lifetimeReceitaCents: 35000,
        lifetimeCompradores: 1,
      },
      { genero: "f" },
    );
    assert.equal(soMulheres.genero.f.pedidos, 2);
    assert.equal(soMulheres.genero.u.pedidos, 0);
    assert.equal(soMulheres.tickets.pedidoCents, 15000);
    const slot = result.heatmap[2][12];
    assert.ok(slot >= 1);
    assert.deepEqual(
      result.serie.map((row) => row.data),
      ["2026-10-07", "2026-10-08"],
    );
    assert.equal(result.serie[0]?.recompraCents, 10000);
    assert.equal(result.serie[0]?.totalCents, 15000);
    assert.equal(result.serie[1]?.recompraCents, 20000);
    assert.equal(result.serie[1]?.totalCents, 20000);
  });

  it("mostra a sequência quando dois compradores seguem o mesmo caminho", () => {
    const depois = new Date("2026-10-08T15:00:00.000Z");
    const caminho = (contato: string, id: string, email: string, nome: string, quando: Date, titulo: string, imagem: string | null) =>
      order({
        id,
        contactId: contato,
        buyerEmail: email,
        buyerName: nome,
        contactName: nome,
        occurredAt: quando,
        items: [{ title: titulo, sku: titulo, quantity: 1, lineTotalCents: 1000, imageUrl: imagem }],
      });
    const result = aggregateComportamento({
      current: [
        caminho("c1", "a1", "a@ex.com", "Ana", new Date("2026-10-07T15:00:00.000Z"), "Óleo", "https://loja.example/oleo.jpg"),
        caminho("c1", "a2", "a@ex.com", "Ana", depois, "Cápsula", "https://loja.example/cap.jpg"),
        caminho("c2", "b1", "b@ex.com", "Bruno", new Date("2026-10-07T15:00:00.000Z"), "Óleo", null),
        caminho("c2", "b2", "b@ex.com", "Bruno", depois, "Cápsula", null),
      ],
      previous: [],
      priorKeys: new Set(),
      lifetimeReceitaCents: 0,
      lifetimeCompradores: 0,
    });
    assert.equal(result.pares.length, 1);
    assert.equal(result.pares[0]?.de, "Óleo");
    assert.equal(result.pares[0]?.para, "Cápsula");
    assert.equal(result.pares[0]?.compradores, 2);
    assert.equal(result.pares[0]?.deImagem, "https://loja.example/oleo.jpg");
    assert.equal(result.pares[0]?.paraImagem, "https://loja.example/cap.jpg");
  });

  it("agrupa o mesmo produto e não faz par consigo mesmo", () => {
    const a = order({
      id: "p1",
      items: [{ title: "Filtro <br />", sku: "A", quantity: 1, lineTotalCents: 1000, imageUrl: "https://loja.example/filtro.jpg" }],
    });
    const b = order({
      id: "p2",
      occurredAt: new Date("2026-10-08T15:00:00.000Z"),
      items: [{ title: "Filtro", sku: "B", quantity: 1, lineTotalCents: 1000 }],
    });
    const result = aggregateComportamento({
      current: [a, b],
      previous: [],
      priorKeys: new Set(),
      lifetimeReceitaCents: 0,
      lifetimeCompradores: 0,
    });
    assert.equal(result.produtos.length, 1);
    assert.equal(result.produtos[0]?.nome, "Filtro");
    assert.equal(result.produtos[0]?.imageUrl, "https://loja.example/filtro.jpg");
    assert.equal(result.produtos[0]?.recompras, 1);
    assert.equal(result.pares.length, 0);
  });

  it("recorte anual soma a receita no mês", () => {
    const serie = densifySerie(
      [
        { data: "2026-01-10", totalCents: 100, primeiraCents: 40, recompraCents: 60 },
        { data: "2026-01-20", totalCents: 50, primeiraCents: 50, recompraCents: 0 },
        { data: "2026-03-02", totalCents: 80, primeiraCents: 0, recompraCents: 80 },
      ],
      new Date("2026-01-01T03:00:00.000Z"),
      new Date("2026-10-08T02:59:59.999Z"),
    );
    assert.equal(serie.serieAgrupamento, "mes");
    assert.equal(serie.serie.find((row) => row.data === "2026-01-01")?.totalCents, 150);
    assert.equal(serie.serie.find((row) => row.data === "2026-01-01")?.primeiraCents, 90);
    assert.equal(serie.serie.find((row) => row.data === "2026-02-01")?.totalCents, 0);
    assert.equal(serie.serie.at(-1)?.data, "2026-10-01");
  });

  it("recorte de 90 dias continua na semana", () => {
    const serie = densifySerie([], new Date("2026-07-10T03:00:00.000Z"), new Date("2026-10-08T02:59:59.999Z"));
    assert.equal(serie.serieAgrupamento, "semana");
  });

  it("filtra pela origem e a lista de origens ignora o próprio filtro", () => {
    const base = {
      current: [
        order({ id: "loja", channel: "direct", totalCents: 10000 }),
        order({ id: "anuncio", channel: "meta_ads", contactId: "c2", buyerEmail: "ads@ex.com", totalCents: 20000 }),
      ],
      previous: [],
      priorKeys: new Set<string>(),
      lifetimeReceitaCents: 0,
      lifetimeCompradores: 0,
    };
    const soAds = aggregateComportamento(base, { origem: "meta_ads" });
    assert.equal(soAds.tickets.pedidos, 1);
    assert.equal(soAds.origens[0]?.id, "meta_ads");
    const lista = aggregateComportamento(base, { origem: "meta_ads", pular: ["origem"] });
    assert.equal(lista.origens.length, 2);
    assert.equal(lista.tickets.pedidos, 2);
  });

  it("filtra a receita nova e a visão sem esse filtro continua com a recompra", () => {
    const base = {
      current: [
        order({ id: "primeira", occurredAt: new Date("2026-10-07T15:00:00.000Z"), totalCents: 10000 }),
        order({ id: "seguinte", occurredAt: new Date("2026-10-08T15:00:00.000Z"), totalCents: 20000 }),
      ],
      previous: [],
      priorKeys: new Set<string>(),
      lifetimeReceitaCents: 0,
      lifetimeCompradores: 0,
    };
    const soNova = aggregateComportamento(base, { compra: "nova" });
    assert.equal(soNova.recompra.pedidosPrimeira, 1);
    assert.equal(soNova.recompra.pedidosRecompra, 0);
    assert.equal(soNova.tickets.pedidos, 1);
    const lista = aggregateComportamento(base, { compra: "nova", pular: ["compra"] });
    assert.equal(lista.recompra.pedidosPrimeira, 1);
    assert.equal(lista.recompra.pedidosRecompra, 1);
  });

  it("recorte de ontem em Brasília começa às 03:00 UTC", () => {
    const range = comportamentoRange({ dataInicio: "2026-10-07", dataFim: "2026-10-07", periodo: null });
    assert.equal(range.start.toISOString(), "2026-10-07T03:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-10-08T02:59:59.999Z");
    assert.equal(range.previousStart.toISOString(), "2026-10-06T03:00:00.000Z");
  });
});
