import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/db";

const baseUrl = process.env.PUBLIC_ACCESS_TEST_BASE_URL;

async function status(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...init });
}

test("anonymous visitors receive only the intended client analysis surface", {
  skip: baseUrl ? false : "set PUBLIC_ACCESS_TEST_BASE_URL to run against a local server",
}, async () => {
  const socialClients = await prisma.cliente.findMany({
    where: { ativo: true, socialMediaAtivo: true },
    select: { id: true, perfilPanel: true },
  });
  const mixed = socialClients.find((client) => client.perfilPanel !== "social-media");
  const socialOnly = socialClients.find((client) => client.perfilPanel === "social-media");
  assert.ok(mixed, "a mixed Social Media fixture is required");
  assert.ok(socialOnly, "a social-only fixture is required");

  const mixedResponse = await status(`/api/clientes/${mixed.id}`);
  assert.equal(mixedResponse.status, 200);
  const mixedBody = await mixedResponse.json() as Record<string, unknown>;
  assert.equal(mixedBody.socialMediaAtivo, true);
  assert.equal(mixedBody.perfilPanel, null);

  const socialOnlyResponse = await status(`/api/clientes/${socialOnly.id}`);
  assert.equal(socialOnlyResponse.status, 200);
  const socialOnlyBody = await socialOnlyResponse.json() as Record<string, unknown>;
  assert.equal(socialOnlyBody.socialMediaAtivo, true);
  assert.equal(socialOnlyBody.perfilPanel, "social-media");

  for (const path of [
    `/api/clientes/${mixed.id}/resumo?canal=meta&periodo=30`,
    `/api/clientes/${mixed.id}/google-keywords?periodo=30`,
    `/api/clientes/${mixed.id}/social-media?periodo=30`,
    `/api/meta/ads?clienteId=${mixed.id}&periodo=30`,
  ]) {
    const response = await status(path);
    assert.equal(response.status, 200, `${path} should be public`);
    const serialized = JSON.stringify(await response.json());
    assert.doesNotMatch(serialized, /access[_-]?token|refresh[_-]?token|client[_-]?secret/i);
  }

  for (const path of [
    "/api/clientes",
    `/api/clientes/${mixed.id}/crm/funil`,
    `/api/clientes/${mixed.id}/campanhas-linkedin?periodo=30`,
    `/api/clientes/${mixed.id}/analista-hotel`,
  ]) {
    assert.equal((await status(path)).status, 401, `${path} should require an internal session`);
  }

  const sync = await status(`/api/clientes/${mixed.id}/sync`, {
    method: "POST",
    headers: { origin: baseUrl! },
  });
  assert.equal(sync.status, 401);
  assert.equal((await status("/clientes")).status, 307);
  assert.equal((await status("/admin/configuracoes")).status, 307);
  assert.equal((await status("/gestao")).status, 307);
});