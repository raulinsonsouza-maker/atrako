/**
 * Serviço WhatsApp Web (whatsapp-web.js) — processo separado do CRM.
 * Conecta via QR Code, persiste sessão (LocalAuth), envia/recebe mensagens.
 * Comunica com o CRM via: POST para inbound, GET /status e POST /send.
 *
 * Env: PORT, CRM_URL, TENANT_ID, AUTH_PATH (opcional)
 * No Windows: use .env ou run.ps1. No Linux/macOS: .env ou PORT=4100 CRM_URL=... npm start
 */

require("dotenv").config();

const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = parseInt(process.env.PORT || "4100", 10);
const CRM_URL = (process.env.CRM_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const TENANT_ID = process.env.TENANT_ID || "";
const AUTH_PATH = process.env.AUTH_PATH || ".wwebjs_auth";

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS para o CRM poder chamar /status e /send a partir do front
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Estado do cliente (qr, status)
let state = { status: "disconnected", qr: null };
const setState = (s, qr = null) => {
  state = { status: s, qr };
};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  setState("qr", qr);
  console.log("[wweb] QR recebido — escaneie no WhatsApp");
});

client.on("ready", () => {
  setState("ready");
  console.log("[wweb] Cliente pronto");
});

client.on("disconnected", (reason) => {
  setState("disconnected");
  console.log("[wweb] Desconectado:", reason);
});

client.on("auth_failure", (msg) => {
  setState("auth_failure");
  console.log("[wweb] Falha de autenticação:", msg);
});

client.on("message", async (msg) => {
  if (!TENANT_ID || !CRM_URL) return;
  const from = msg.from;
  const phone = from.replace(/@.+$/, "").replace(/\D/g, "");
  const body = msg.body || "";
  const type = (msg.type || "chat").toLowerCase();

  if (!body && type === "chat") return;

  const text = body.slice(0, 4000) || `[${type}]`;
  const payload = {
    tenantId: TENANT_ID,
    phone,
    content: text,
    type: type === "chat" ? "text" : type,
    externalId: msg.id?._id || msg.id,
    fromNumber: from,
  };

  try {
    const res = await fetch(`${CRM_URL}/api/webhooks/whatsapp-wweb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("[wweb] CRM webhook erro:", res.status, await res.text());
  } catch (e) {
    console.error("[wweb] Erro ao enviar para CRM:", e.message);
  }
});

// ——— Rotas HTTP ———

app.get("/status", (req, res) => {
  res.json({ status: state.status, qr: state.qr || undefined });
});

app.get("/qr", (req, res) => {
  res.json({ qr: state.qr || null });
});

app.post("/send", async (req, res) => {
  const { to, text } = req.body || {};
  const num = String(to || "").replace(/\D/g, "");
  if (!num || !text || typeof text !== "string") {
    return res.status(400).json({ ok: false, error: "to e text são obrigatórios" });
  }
  const jid = `${num}@s.whatsapp.net`;
  try {
    await client.sendMessage(jid, text);
    res.json({ ok: true });
  } catch (e) {
    console.error("[wweb] Erro ao enviar:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "whatsapp-wweb" });
});

// ——— Inicialização ———

async function main() {
  if (!TENANT_ID) console.warn("[wweb] TENANT_ID não definido; mensagens recebidas não serão enviadas ao CRM.");
  if (!CRM_URL) console.warn("[wweb] CRM_URL não definido.");

  app.listen(PORT, () => {
    console.log(`[wweb] HTTP em :${PORT} (CRM=${CRM_URL}, TENANT_ID=${TENANT_ID || "(vazio)"})`);
  });

  setState("disconnected");
  client.initialize();
}

main().catch((e) => {
  console.error("[wweb] Falha ao iniciar:", e);
  process.exit(1);
});
