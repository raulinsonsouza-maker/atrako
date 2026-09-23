/**
 * WhatsApp Web integrado ao CRM: um Client (whatsapp-web.js) por tenant.
 * O QR é exibido nas configurações do CRM; o usuário conecta escaneando com o celular.
 * Sessão persistida em data/wweb_auth/tenant_<id>.
 */

import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { Client, LocalAuth } from "whatsapp-web.js";
import { processInboundWwebMessage } from "./wweb-inbound";

const execAsync = promisify(exec);

type WwebState = { status: string; qr?: string | null };

const clients = new Map<string, { client: Client; state: WwebState }>();

function getDataPath(tenantId: string): string {
  const dir = path.join(process.cwd(), "data", "wweb_auth", `tenant_${tenantId}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function setState(tenantId: string, status: string, qr?: string | null): void {
  const e = clients.get(tenantId);
  if (e) e.state = { status, qr: qr ?? undefined };
}

// Flag para evitar recursão infinita ao tentar recriar após erro
const recreatingClients = new Set<string>();
// Flag para evitar inicialização concorrente no mesmo processo
const initializingClients = new Set<string>();
const INIT_LOCK_TTL_MS = 2 * 60 * 1000;

function getInitLockPath(tenantId: string): string {
  return path.join(getDataPath(tenantId), ".init.lock");
}

function tryAcquireInitLock(tenantId: string): boolean {
  const lockPath = getInitLockPath(tenantId);
  const now = Date.now();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${process.pid}:${now}`);
      fs.closeSync(fd);
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        console.warn("[wweb] Falha ao criar lock de init:", err);
        return false;
      }
      try {
        const stat = fs.statSync(lockPath);
        if (now - stat.mtimeMs > INIT_LOCK_TTL_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        // Se não conseguir ler o lock, tenta novamente
      }
      return false;
    }
  }
  return false;
}

function releaseInitLock(tenantId: string): void {
  const lockPath = getInitLockPath(tenantId);
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Ignora erros ao remover lock
  }
}

function isInitLocked(tenantId: string): boolean {
  const lockPath = getInitLockPath(tenantId);
  try {
    const stat = fs.statSync(lockPath);
    const now = Date.now();
    if (now - stat.mtimeMs > INIT_LOCK_TTL_MS) {
      fs.unlinkSync(lockPath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function killBrowserUsingDataPath(dataPath: string): Promise<void> {
  if (process.platform !== "win32") return;

  try {
    const regex = dataPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '--user-data-dir' -and $_.CommandLine -match '${regex}' } | Select-Object -ExpandProperty ProcessId`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${ps}"`);
    const pids = stdout
      .split(/\s+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    for (const pid of pids) {
      try {
        await execAsync(`taskkill /F /T /PID ${pid}`);
        console.log("[wweb] Processo de browser encerrado:", pid);
      } catch {
        // Ignora falhas ao matar processos individuais
      }
    }
  } catch (err) {
    console.log("[wweb] Falha ao encerrar browser travado:", err);
  }
}

/**
 * Tenta remover locks e aguardar que processos do Chrome terminem.
 * Não mata processos agressivamente para evitar afetar outros usos do Chrome.
 */
async function clearBrowserLocks(dataPath: string): Promise<void> {
  try {
    // Remove arquivos de lock que podem estar bloqueando
    const lockFiles = [
      path.join(dataPath, "SingletonLock"),
      path.join(dataPath, "lockfile"),
      path.join(dataPath, "session", "SingletonLock"),
      path.join(dataPath, "Default", "SingletonLock"),
    ];
    
    for (const lockFile of lockFiles) {
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
          console.log("[wweb] Removido arquivo de lock:", lockFile);
        }
      } catch {
        // Ignora erros - locks podem estar em uso
      }
    }
    
    // Aguarda um pouco para processos terminarem naturalmente
    await sleep(3000);
  } catch (err) {
    // Ignora erros
    console.log("[wweb] Erro ao limpar locks:", err);
  }
}

async function waitForReady(tenantId: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const e = clients.get(tenantId);
    if (e?.state.status === "ready") return true;
    if (!e && !isInitLocked(tenantId)) return false;
    await sleep(500);
  }
  return false;
}

function normalizePhoneToWid(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `${digits}@c.us`;
}

/**
 * Cria ou retorna o Client do tenant. Inicia a conexão (QR ou sessão existente).
 * Idempotente.
 * 
 * @param forceRecreate Se true, força a recriação mesmo se já existir (útil para resetar estado preso)
 */
export async function getOrCreateClient(tenantId: string, forceRecreate = false): Promise<void> {
  // Evita recursão infinita
  if (recreatingClients.has(tenantId)) {
    console.log("[wweb] Já está recriando cliente para tenant", tenantId.slice(0, 8));
    return;
  }
  if (initializingClients.has(tenantId)) {
    console.log("[wweb] Inicialização em andamento para tenant", tenantId.slice(0, 8));
    return;
  }
  if (clients.has(tenantId) && !forceRecreate) {
    // Se está preso em "starting" por muito tempo, força recriação
    const e = clients.get(tenantId);
    if (e && e.state.status === "starting") {
      // Verifica se está preso há mais de 2 minutos (pode ser um problema)
      // Mas não força automaticamente, deixa o usuário decidir
      return;
    }
    return;
  }

  // Evita inicialização concorrente entre processos (lock em arquivo)
  if (!tryAcquireInitLock(tenantId)) {
    console.log("[wweb] Lock de init já existe para tenant", tenantId.slice(0, 8));
    return;
  }
  initializingClients.add(tenantId);
  
  // Se forceRecreate, remove o cliente existente primeiro
  if (forceRecreate && clients.has(tenantId)) {
    const e = clients.get(tenantId);
    if (e) {
      try {
        // Primeiro tenta fazer logout para encerrar a sessão corretamente
        try {
          await e.client.logout().catch(() => {});
        } catch {
          // Ignora erros no logout
        }
        
        // Depois destrói o cliente
        await e.client.destroy().catch(() => {});
        
        // Aguarda mais tempo para o browser fechar completamente
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch {
        // Ignora erros ao destruir
      }
      clients.delete(tenantId);
    }
    
    // Remove apenas arquivos de autenticação específicos, não toda a pasta
    // Isso evita conflitos com browser ainda rodando
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const dataPath = getDataPath(tenantId);
    try {
      if (fs.existsSync(dataPath)) {
        console.log("[wweb] Removendo sessão salva para forçar novo QR");
        
        // Remove apenas arquivos de autenticação específicos do WhatsApp Web
        // Não remove toda a pasta para evitar conflitos com browser rodando
        const authFiles = [
          path.join(dataPath, ".wwebjs_auth"),
          path.join(dataPath, ".wwebjs_cache"),
        ];
        
        for (const authFile of authFiles) {
          try {
            if (fs.existsSync(authFile)) {
              if (fs.statSync(authFile).isDirectory()) {
                fs.rmSync(authFile, { recursive: true, force: true });
              } else {
                fs.unlinkSync(authFile);
              }
            }
          } catch {
            // Ignora erros ao remover arquivos individuais
          }
        }
        
        // Tenta remover locks do Chrome/Puppeteer
        const lockFiles = [
          path.join(dataPath, "SingletonLock"),
          path.join(dataPath, "lockfile"),
          path.join(dataPath, "session", "SingletonLock"),
        ];
        
        for (const lockFile of lockFiles) {
          try {
            if (fs.existsSync(lockFile)) {
              fs.unlinkSync(lockFile);
            }
          } catch {
            // Ignora erros - locks podem estar em uso
          }
        }
        
        console.log("[wweb] Arquivos de autenticação removidos (ou tentados)");
      }
    } catch (err) {
      console.error("[wweb] Erro ao remover sessão:", err);
      // Não falha completamente - continua mesmo se não conseguir remover
      // O takeoverOnConflict deve resolver o conflito
    }
  }

  const dataPath = getDataPath(tenantId);
  let finalized = false;
  const finalizeInit = () => {
    if (finalized) return;
    finalized = true;
    initializingClients.delete(tenantId);
    releaseInitLock(tenantId);
  };
  const state: WwebState = { status: "starting" };
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath }),
    takeoverOnConflict: true,
    takeoverTimeoutMs: 30000, // 30 segundos - tempo suficiente para o browser fechar
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--no-first-run",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-default-apps",
        "--mute-audio",
        "--no-default-browser-check",
      ],
    },
  });

  client.on("qr", (qr) => {
    setState(tenantId, "qr", qr);
    console.log("[wweb] QR para tenant", tenantId.slice(0, 8), "— escaneie no WhatsApp");
    console.log("[wweb] QR Code recebido, tamanho:", qr?.length || 0);
  });

  client.on("ready", () => {
    setState(tenantId, "ready");
    console.log("[wweb] Cliente pronto para tenant", tenantId.slice(0, 8));
  });

  client.on("disconnected", (reason) => {
    const e = clients.get(tenantId);
    if (e) clients.delete(tenantId);
    console.log("[wweb] Desconectado tenant", tenantId.slice(0, 8), reason);
    
    // LOGOUT = usuário desvinculou no celular; não reconectar (irá pedir novo QR em Config)
    if (reason === "LOGOUT") {
      // Remove sessão salva quando usuário desvincula manualmente
      const dataPath = getDataPath(tenantId);
      try {
        if (fs.existsSync(dataPath)) {
          fs.rmSync(dataPath, { recursive: true, force: true });
        }
      } catch {
        // Ignora erros
      }
      return;
    }
    
    // Se foi desconectado por erro de autenticação ou conflito, não reconecta automaticamente
    // O usuário precisa tentar novamente manualmente
    if (reason && (reason.toString().includes("401") || reason.toString().includes("NotAuthorized"))) {
      console.log("[wweb] Desconexão por erro de autenticação - não reconectando automaticamente");
      return;
    }
    
    // Reconectar após 5s apenas para desconexões normais (rede, etc.)
    setTimeout(async () => {
      await getOrCreateClient(tenantId);
      console.log("[wweb] Reconectando tenant", tenantId.slice(0, 8));
    }, 5000);
  });

  client.on("auth_failure", (msg) => {
    setState(tenantId, "auth_failure");
    console.log("[wweb] Falha de auth tenant", tenantId.slice(0, 8), msg);
    
    // Quando há auth_failure, remove o cliente para permitir nova tentativa
    // Não reconecta automaticamente - o usuário precisa tentar novamente manualmente
    const e = clients.get(tenantId);
    if (e) {
      try {
        e.client.destroy().catch(() => {});
      } catch {
        // Ignora erros
      }
      clients.delete(tenantId);
    }
    
    // Remove a sessão salva que pode estar corrompida
    const dataPath = getDataPath(tenantId);
    try {
      if (fs.existsSync(dataPath)) {
        console.log("[wweb] Removendo sessão corrompida após auth_failure");
        fs.rmSync(dataPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error("[wweb] Erro ao remover sessão após auth_failure:", err);
    }
  });

  client.on("message", async (msg) => {
    const from = msg.from || "";
    const phone = from.replace(/@.+$/, "").replace(/\D/g, "");
    const body = (msg.body || "").slice(0, 4000);
    const type = ((msg as { type?: string }).type || "chat").toLowerCase();
    const id = (msg as { id?: string | { _id?: string } }).id;
    const externalId = typeof id === "object" && id && "_id" in id ? (id as { _id?: string })._id : id;

    if (!body && type === "chat") return;

    try {
      await processInboundWwebMessage(tenantId, {
        phone,
        content: body || `[${type}]`,
        type: type === "chat" ? "text" : type,
        externalId: externalId ? String(externalId) : undefined,
      });
    } catch (e) {
      console.error("[wweb] Erro ao processar mensagem:", e);
    }
  });

  clients.set(tenantId, { client, state });
  
  console.log("[wweb] Inicializando cliente para tenant", tenantId.slice(0, 8));
  client
    .initialize()
    .catch(async (err) => {
    console.error("[wweb] Erro ao inicializar cliente:", err);
    
    // Se o erro for "browser already running", tenta aguardar e usar takeover
    if (err instanceof Error && err.message.includes("already running")) {
      console.log("[wweb] Browser ainda rodando, tentando resolver...");
      clients.delete(tenantId);
      
      // Se já está tentando recriar, não tenta novamente (evita loop)
      if (recreatingClients.has(tenantId)) {
        console.log("[wweb] Já está tentando recriar, aguardando resultado...");
        setState(tenantId, "starting", null);
        return;
      }
      
      recreatingClients.add(tenantId);
      
      try {
        console.log("[wweb] Tentando encerrar processo travado pelo userDataDir...");
        await killBrowserUsingDataPath(dataPath);

        // Limpa locks e aguarda processos terminarem
        console.log("[wweb] Limpando locks e aguardando processos terminarem...");
        await clearBrowserLocks(dataPath);
        
        // Aguarda tempo suficiente para o browser fechar completamente
        // O takeoverTimeoutMs é 30s, então aguardamos um pouco mais que isso
        console.log("[wweb] Aguardando 35 segundos para processos terminarem completamente...");
        await new Promise((resolve) => setTimeout(resolve, 35000));
        
        // Limpa locks novamente após a espera
        await clearBrowserLocks(dataPath);
        
        // Aguarda mais um pouco
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        // Limpa a flag antes de tentar criar
        recreatingClients.delete(tenantId);
        
        // Tenta criar novamente (sem forceRecreate para evitar loop)
        // Mas primeiro verifica se já não existe
        if (!clients.has(tenantId)) {
          console.log("[wweb] Tentando criar cliente novamente após resolver conflito...");
          finalizeInit();
          await getOrCreateClient(tenantId, false);
        }
        return;
      } catch (retryErr) {
        recreatingClients.delete(tenantId);
        console.error("[wweb] Erro ao tentar recriar após 'already running':", retryErr);
        setState(tenantId, "auth_failure", null);
        return;
      }
    }
    
    setState(tenantId, "auth_failure", null);
  })
  .finally(finalizeInit);
}

export function getState(tenantId: string): WwebState {
  const e = clients.get(tenantId);
  if (!e) return { status: "disconnected" };
  return { ...e.state };
}

export async function sendMessage(tenantId: string, to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  let e = clients.get(tenantId);
  if (!e && isInitLocked(tenantId)) {
    // Se estiver inicializando em outro processo, espera concluir
    await waitForReady(tenantId, 15000);
    e = clients.get(tenantId);
  }
  if (!e) return { ok: false, error: "Cliente WhatsApp não iniciado para este tenant. Configure em Configurações > WhatsApp." };
  
  if (e.state.status !== "ready") {
    if (e.state.status === "starting") {
      const ready = await waitForReady(tenantId, 15000);
      if (ready) {
        e = clients.get(tenantId);
      }
    }
  }

  if (!e || e.state.status !== "ready") {
    if (!e) {
      return { ok: false, error: "Cliente WhatsApp não iniciado para este tenant. Configure em Configurações > WhatsApp." };
    }
    const statusMsg = e.state.status === "qr" 
      ? "WhatsApp aguardando escaneamento do QR Code. Escaneie em Configurações > WhatsApp."
      : e.state.status === "starting"
      ? "WhatsApp está iniciando. Aguarde alguns segundos e tente novamente."
      : e.state.status === "auth_failure"
      ? "Falha de autenticação. Reconecte em Configurações > WhatsApp."
      : "WhatsApp não está conectado. Escaneie o QR Code em Configurações > WhatsApp.";
    return { ok: false, error: statusMsg };
  }

  const jid = normalizePhoneToWid(to);
  if (!jid) return { ok: false, error: "Número inválido." };

  try {
    const isRegistered = await e.client.isRegisteredUser(jid).catch(() => false);
    if (!isRegistered) {
      return { ok: false, error: "Número não registrado no WhatsApp." };
    }

    await e.client.sendMessage(jid, text);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[wweb] Erro ao enviar:", msg);
    // Erros internos da lib (ex.: markedUnread, undefined) — mensagem amigável
    if (/markedUnread|Cannot read properties of undefined/i.test(msg)) {
      return {
        ok: false,
        error: "Erro ao enviar pelo WhatsApp. Verifique se o número existe e se a conexão está ativa.",
      };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Envia indicador "digitando" (typing) para o chat. WhatsApp some ao enviar mensagem.
 */
export async function sendTyping(tenantId: string, to: string): Promise<{ ok: boolean; error?: string }> {
  let e = clients.get(tenantId);
  if (!e && isInitLocked(tenantId)) {
    await waitForReady(tenantId, 15000);
    e = clients.get(tenantId);
  }
  if (!e || e.state.status !== "ready") {
    return { ok: false, error: "Cliente WhatsApp não pronto." };
  }
  const jid = normalizePhoneToWid(to);
  if (!jid) return { ok: false, error: "Número inválido." };
  try {
    const chat = await e.client.getChatById(jid);
    await chat.sendStateTyping();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[wweb] Erro ao enviar typing:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Desconecta e remove o cliente WhatsApp do tenant.
 * Remove também os arquivos de autenticação.
 */
export async function disconnectClient(tenantId: string): Promise<void> {
  const e = clients.get(tenantId);
  if (e) {
    try {
      await e.client.logout();
      await e.client.destroy();
    } catch (err) {
      console.error("[wweb] Erro ao desconectar cliente:", err);
    }
    clients.delete(tenantId);
  }

  // Remove arquivos de autenticação
  try {
    const dataPath = getDataPath(tenantId);
    if (fs.existsSync(dataPath)) {
      fs.rmSync(dataPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("[wweb] Erro ao remover arquivos de auth:", err);
  }
}
