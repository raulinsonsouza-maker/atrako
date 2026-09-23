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
CID=$(docker ps -q -f name=book_web | sed -n '1p')
echo CID=$CID
echo '==== recent errors / intake / signup / book ===='
docker logs --since 2h "$CID" 2>&1 | grep -iE 'error|intake|signup|book|prisma|fail|exception|ENOENT|TypeError|500' | tail -n 120
echo '==== last 80 lines ===='
docker logs --tail 80 "$CID" 2>&1
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=90, get_pty=True)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err)
client.close()
