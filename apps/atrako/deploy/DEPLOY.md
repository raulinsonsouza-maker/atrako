# Deploy Atrako → VPS (atrako.com.br)

Build no PC (Docker Desktop), envia a imagem, sobe stack Swarm + Traefik.

## 1. Build local

```powershell
cd c:\Users\Raul\Desktop\Atrako
docker build --platform linux/amd64 -f apps/atrako/Dockerfile -t atrako-web:latest .
docker save atrako-web:latest -o atrako-web.tar
```

## 2. Enviar para a VPS

```powershell
scp -i $env:USERPROFILE\.ssh\atrako_hetzner_ed25519 atrako-web.tar root@5.75.172.83:/opt/apps/atrako/
scp -i $env:USERPROFILE\.ssh\atrako_hetzner_ed25519 apps\atrako\deploy\stack.yml root@5.75.172.83:/opt/apps/atrako/
```

## 3. Na VPS

```bash
cd /opt/apps/atrako
# criar .env a partir de .env.example com senhas fortes
docker load -i atrako-web.tar
rm -f atrako-web.tar
set -a && source .env && set +a
docker stack deploy -c stack.yml atrako
docker service ls | grep atrako
docker service logs -f atrako_web
```

## 4. Smoke

```bash
curl -fsS https://atrako.com.br/api/health
curl -I https://atrako.com.br
curl -I https://www.atrako.com.br
```

## Atualizar

Repetir build + save + load + `docker service update --image atrako-web:latest atrako_web` (ou `stack deploy` de novo).
