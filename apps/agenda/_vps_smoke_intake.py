import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FIND_JS = r"""
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const links = await p.checkoutLink.findMany({
    where: { isActive: true, product: { productKind: "INTAKE", isActive: true } },
    select: {
      slug: true,
      accentColor: true,
      product: {
        select: {
          title: true,
          organization: { select: { slug: true, name: true } },
        },
      },
    },
    take: 10,
  });
  console.log("LINKS=" + JSON.stringify(links));
  const services = await p.service.findMany({
    where: { intakeProductId: { not: null }, isActive: true },
    select: {
      title: true,
      bookingPage: { select: { slug: true, accentColor: true } },
      organization: { select: { slug: true } },
      intakeProduct: {
        select: {
          checkoutLinks: { select: { slug: true, isActive: true }, take: 3 },
        },
      },
    },
    take: 10,
  });
  console.log("SERVICES=" + JSON.stringify(services));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    os.environ["VPS_HOST"],
    username=os.environ["VPS_USER"],
    password=os.environ["VPS_PASS"],
    timeout=30,
)
sftp = client.open_sftp()
with sftp.file("/tmp/find-intake.js", "w") as f:
    f.write(FIND_JS)
sftp.close()

cmd = r"""
CID=$(docker ps -q -f name=book_web | sed -n '1p')
docker cp /tmp/find-intake.js "$CID":/app/find-intake.js
docker exec -w /app "$CID" node find-intake.js
SLUG=$(docker exec -w /app "$CID" node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.checkoutLink.findFirst({where:{isActive:true,product:{productKind:'INTAKE',isActive:true}},select:{slug:true}}).then(async l=>{console.log(l?l.slug:''); await p.\$disconnect();})")
echo SLUG=$SLUG
PAYLOAD='{"stepId":"partners","data":{"partners":[{"fullName":"Smoke Test","cpf":"529.982.247-25","rg":"12.345.678-9","email":"smoke@example.com","phone":"(11) 99999-9999","profession":"Advogado","maritalStatus":"solteiro","zipCode":"01310-100","street":"Av Paulista","number":"1000","complement":"","district":"Bela Vista","city":"Sao Paulo","state":"SP"}],"ownership":[{"partnerIndex":0,"percentage":100}]}}'
echo "==== POST intake ===="
docker exec "$CID" curl -sS -m 25 -w '\nHTTP %{http_code} TIME %{time_total}\n' \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  "http://127.0.0.1:3000/api/public/checkout/${SLUG}/intake" || echo CURL_FAIL
echo
echo "==== logs ===="
docker logs --tail 60 "$CID" 2>&1 | grep -viE 'npm notice|New major' || true
docker exec "$CID" rm -f /app/find-intake.js
rm -f /tmp/find-intake.js
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=120, get_pty=True)
print(stdout.read().decode("utf-8", "replace"))
client.close()
