import paramiko
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "191.252.109.144"
USER = "root"
PASSWORD = "Sucesso@2025"
LOCAL_TAR = Path(r"c:\Users\Raul\Desktop\Plataforma_de_vendas\deploy-artifact.tar.gz")
REMOTE_TAR = "/tmp/plataforma-vendas.tar.gz"
APP_DIR = "/opt/plataforma-vendas"
PIXEL = "3595042497343941"

REMOTE_SCRIPT = r'''
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

APP="/opt/plataforma-vendas"
TAR="/tmp/plataforma-vendas.tar.gz"
PIXEL="3595042497343941"

mkdir -p "$APP"
mkdir -p /tmp/pv-backup
cp -a "$APP/.env" /tmp/pv-backup/.env 2>/dev/null || true
cp -a "$APP/.env.production" /tmp/pv-backup/.env.production 2>/dev/null || true
cp -a "$APP/ecosystem.config.cjs" /tmp/pv-backup/ecosystem.config.cjs 2>/dev/null || true
cp -a "$APP/data" /tmp/pv-backup/data 2>/dev/null || true

rm -rf /tmp/pv-stage
mkdir -p /tmp/pv-stage
tar -xzf "$TAR" -C /tmp/pv-stage

find "$APP" -mindepth 1 -maxdepth 1 ! -name 'data' ! -name '.env' ! -name '.env.production' ! -name 'ecosystem.config.cjs' -exec rm -rf {} +
cp -a /tmp/pv-stage/. "$APP/"

if [ -f /tmp/pv-backup/.env ]; then cp -a /tmp/pv-backup/.env "$APP/.env"; fi
if [ -f /tmp/pv-backup/.env.production ]; then cp -a /tmp/pv-backup/.env.production "$APP/.env.production"; fi
if [ -f /tmp/pv-backup/ecosystem.config.cjs ]; then cp -a /tmp/pv-backup/ecosystem.config.cjs "$APP/ecosystem.config.cjs"; fi
if [ -d /tmp/pv-backup/data ]; then
  mkdir -p "$APP/data"
  cp -a /tmp/pv-backup/data/. "$APP/data/"
fi

if [ ! -f "$APP/.env" ]; then
  echo "ERROR: missing $APP/.env" >&2
  exit 1
fi
if grep -q '^META_PIXEL_ID=' "$APP/.env"; then
  sed -i "s/^META_PIXEL_ID=.*/META_PIXEL_ID=\"$PIXEL\"/" "$APP/.env"
else
  echo "META_PIXEL_ID=\"$PIXEL\"" >> "$APP/.env"
fi
cp -f "$APP/.env" "$APP/.env.production"

if [ ! -f "$APP/ecosystem.config.cjs" ]; then
cat > "$APP/ecosystem.config.cjs" <<'ECO'
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, ".env");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
}
module.exports = {
  apps: [{
    name: "plataforma-vendas",
    script: "server.js",
    cwd: __dirname,
    env: {
      ...env,
      NODE_ENV: "production",
      PORT: "3010",
      HOSTNAME: "127.0.0.1",
    },
  }],
};
ECO
fi

# Ensure DATABASE_URL absolute path for sqlite
if grep -q '^DATABASE_URL=' "$APP/.env"; then
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:/opt/plataforma-vendas/data/prod.db"|' "$APP/.env"
  cp -f "$APP/.env" "$APP/.env.production"
fi

cd "$APP"
export DATABASE_URL="file:/opt/plataforma-vendas/data/prod.db"
node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PIXEL = "3595042497343941";
(async () => {
  await prisma.pixelConfig.upsert({
    where: { id: "default" },
    update: { pixelId: PIXEL },
    create: { id: "default", pixelId: PIXEL },
  });
  for (const slug of ["air-fryer-50-receitas", "100-melhores-bolos", "plantas-medicinais"]) {
    const p = await prisma.product.findUnique({ where: { slug } });
    if (p) {
      const data = { status: "PUBLISHED" };
      if (slug === "air-fryer-50-receitas" || slug === "100-melhores-bolos") {
        data.metaPixelId = PIXEL;
      }
      await prisma.product.update({ where: { slug }, data });
      console.log("updated", slug);
    } else {
      console.log("MISSING", slug);
    }
  }
  const rows = await prisma.product.findMany({
    where: { slug: { in: ["air-fryer-50-receitas", "100-melhores-bolos", "plantas-medicinais"] } },
    select: { slug: true, metaPixelId: true, status: true, priceCents: true },
  });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("DB update failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
NODE

pm2 delete plataforma-vendas || true
pm2 start "$APP/ecosystem.config.cjs"
pm2 save
sleep 3
pm2 list
curl -s -o /dev/null -w "local_root:%{http_code}\n" http://127.0.0.1:3010/ || true
curl -s -o /dev/null -w "local_bolos:%{http_code}\n" --max-time 30 http://127.0.0.1:3010/p/100-melhores-bolos || true
curl -s -o /dev/null -w "local_air:%{http_code}\n" --max-time 30 http://127.0.0.1:3010/p/air-fryer-50-receitas || true
echo DONE
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {HOST}...")
client.connect(HOST, username=USER, password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)

print(f"Uploading {LOCAL_TAR.name} ({LOCAL_TAR.stat().st_size} bytes)...")
sftp = client.open_sftp()
sftp.put(str(LOCAL_TAR), REMOTE_TAR)
sftp.close()
print("Upload done. Extracting/restarting...")

stdin, stdout, stderr = client.exec_command(REMOTE_SCRIPT, timeout=600)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
print(out)
if err.strip():
    print("STDERR:\n", err)
print("exit", code)
client.close()
sys.exit(code)
