import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    os.environ["VPS_HOST"],
    username=os.environ["VPS_USER"],
    password=os.environ["VPS_PASS"],
    timeout=30,
)

cmd = r"""
PAYLOAD='{"stepId":"partners","data":{"partners":[{"fullName":"Smoke Test","cpf":"529.982.247-25","rgOrCnh":"12.345.678-9","birthDate":"1990-01-01","nationality":"Brasileira","email":"smoke@example.com","phone":"(11) 99999-9999","profession":"Advogado","maritalStatus":"single","zipCode":"01310-100","address":"Av Paulista","addressNumber":"1000","addressComplement":"","cpfOnIdDoc":true}],"ownership":[{"partnerIndex":0,"percentage":100}]}}'
echo '==== HTTPS via Cloudflare with browser UA ===='
curl -sS -m 25 -w '\nHTTP %{http_code} TIME %{time_total}\n' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' \
  -H 'Origin: https://book.symbius.com.br' \
  -H 'Referer: https://book.symbius.com.br/' \
  -d "$PAYLOAD" \
  'https://book.symbius.com.br/api/public/checkout/abertura-de-empresa-mtixicil/intake' || echo CURL_FAIL
echo
echo '==== Cloudflare/traefik access recent ===='
docker service logs traefik_traefik --since 30m 2>&1 | grep -iE 'intake|403|1010|abertura|book.symbius' | tail -n 40 || true
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=60, get_pty=True)
print(stdout.read().decode("utf-8", "replace"))
client.close()
