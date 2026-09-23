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
echo '==== intake/pay errors last 2h ===='
docker service logs traefik_traefik --since 2h 2>&1 | grep -iE 'abertura-de-empresa|intake|/pay' | grep -vE ' 200 ' | tail -n 50
echo '==== abandon calls ===='
docker service logs traefik_traefik --since 6h 2>&1 | grep -i 'abandon' | tail -n 20
echo '==== recent 4xx/5xx book.symbius ===='
docker service logs traefik_traefik --since 2h 2>&1 | grep 'book@docker' | grep -vE ' 200 | 304 | 307 | 302 ' | tail -n 40
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=90, get_pty=True)
print(stdout.read().decode("utf-8", "replace"))
client.close()
