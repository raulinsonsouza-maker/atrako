import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceConversation,
  conversationFromConfig,
  conversationPreview,
  conversationProblems,
  conversationStepPayload,
  defaultConversation,
  parseConversationStepPayload,
} from "../lib/instagram/conversation";

const conversation = defaultConversation();

test("conversa antiga sem passos continua no funil anterior", () => {
  assert.equal(conversationFromConfig({ replyText: "Olá", buttons: [{ label: "Site", action: "link" }] }), null);
  assert.equal(conversationFromConfig({ welcomeText: "Oi", welcomeButton: "Link" }), null);
  assert.equal(conversationProblems(conversation), null);
});

test("o primeiro passo espera o botão e o telefone válido qualifica o lead", () => {
  const started = advanceConversation({ conversation, stepId: null, wait: null, event: { kind: "start" } });
  assert.equal(started?.status, "WAITING");
  assert.equal(started?.wait, "button");
  assert.equal(started?.send?.buttons[0]?.stepId, "telefone");
  assert.equal(started?.capture, null);

  const asking = advanceConversation({
    conversation,
    stepId: "abrir",
    wait: "button",
    event: { kind: "goto", stepId: "telefone" },
  });
  assert.equal(asking?.wait, "phone");

  const invalid = advanceConversation({
    conversation,
    stepId: "telefone",
    wait: "phone",
    event: { kind: "text", text: "oi" },
  });
  assert.equal(invalid?.capture, null);
  assert.equal(invalid?.repeat, true);
  assert.equal(invalid?.status, "WAITING");

  const phone = advanceConversation({
    conversation,
    stepId: "telefone",
    wait: "phone",
    event: { kind: "text", text: "(11) 98888-7777" },
  });
  assert.deepEqual(phone?.capture, { field: "phone", value: "11988887777" });
  assert.equal(phone?.wait, "email");

  const email = advanceConversation({
    conversation,
    stepId: "email",
    wait: "email",
    event: { kind: "text", text: "Nome@Email.com" },
  });
  assert.deepEqual(email?.capture, { field: "email", value: "nome@email.com" });
  assert.equal(email?.status, "COMPLETED");
  assert.equal(email?.send, null);
});

test("botão de encaminhar encerra e o link guarda o endereço", () => {
  const withEnd = {
    steps: [
      ...conversation.steps,
      {
        id: "site",
        type: "link" as const,
        text: "Abra a página",
        label: "Acessar",
        url: "https://lp.regicenter.com",
        thanks: "Obrigado",
        goTo: "equipe",
      },
      { id: "equipe", type: "handoff" as const, text: "A equipe continua daqui." },
    ],
  };
  const link = advanceConversation({
    conversation: withEnd,
    stepId: "abrir",
    wait: "button",
    event: { kind: "goto", stepId: "site" },
  });
  assert.equal(link?.send?.buttons[0]?.type, "web_url");
  assert.equal(link?.send?.buttons[0] && "url" in link.send.buttons[0] ? link.send.buttons[0].url : "", "https://lp.regicenter.com/");
  const team = advanceConversation({
    conversation: withEnd,
    stepId: "site",
    wait: "link",
    event: { kind: "goto", stepId: "equipe" },
  });
  assert.equal(team?.handoff, true);
  assert.equal(team?.status, "COMPLETED");
});

test("o clique do botão aponta para o passo e a prévia mostra o caminho", () => {
  const payload = conversationStepPayload("flow", "telefone");
  assert.deepEqual(parseConversationStepPayload(payload), { fluxoId: "flow", stepId: "telefone" });
  assert.equal(parseConversationStepPayload("symbius_dm:flow:0"), null);
  const items = conversationPreview(conversation, "telefone");
  assert.equal(items.some((item) => item.kind === "received" && item.text.includes("telefone")), true);
  assert.equal(items.some((item) => item.kind === "sent" && item.text === "11999999999"), true);
});
