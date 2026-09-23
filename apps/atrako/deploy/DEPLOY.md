# Deploy Atrako → VPS (atrako.com.br)

Com o código no GitHub, o fluxo padrão é **build na VPS** (sem Docker Desktop no PC).

## Pré-requisitos (já feitos)

- Repo: https://github.com/raulinsonsouza-maker/atrako
- Clone em `/opt/apps/atrako/src`
- `.env` em `/opt/apps/atrako/.env` (inclui `ML_*`)
- SSH: `~/.ssh/atrako_hetzner_ed25519` → `root@5.75.172.83`

## Atualizar (pull → build → stack)

Na VPS:

```bash
cd /opt/apps/atrako/src
git pull --ff-only origin main
cp -f apps/atrako/deploy/stack.yml /opt/apps/atrako/stack.yml

docker build --platform linux/amd64 -f apps/atrako/Dockerfile -t atrako-web:latest .

cd /opt/apps/atrako
set -a && source .env && set +a
docker stack deploy -c stack.yml atrako
docker service update --force --image atrako-web:latest atrako_web
docker service logs -f atrako_web
```

## Smoke

```bash
curl -fsS https://atrako.com.br/api/health
curl -I https://atrako.com.br
```

## Alternativa (build no PC)

Só se o Docker Desktop local estiver ok — ver fluxo antigo com `docker save` + `scp` do `.tar`.
