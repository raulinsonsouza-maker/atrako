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
echo '==== full log size / recent non-migrate ===='
docker logs --since 6h "$CID" 2>&1 | wc -l
docker logs --since 6h "$CID" 2>&1 | grep -viE 'prisma|npm notice|migrate|Schema engine|New major version' | tail -n 150
echo '==== try intake POST smoke ===='
# find an intake checkout slug from DB
docker exec -w /app "$CID" node -e '
const {PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
(async()=>{
  const link=await p.checkoutLink.findFirst({
    where:{ active:true, product:{ productKind:"INTAKE" } },
    include:{ product:true, organization:true }
  });
  console.log(JSON.stringify(link?{slug:link.slug, product:link.product.title, org:link.organization.slug}:{none:true}));
  const pages=await p.bookingPage.findMany({take:5, select:{slug:true, organization:{select:{slug:true}}, accentColor:true}});
  console.log("PAGES", JSON.stringify(pages));
  await p.$disconnect();
})().catch(e=>{console.error(e); process.exit(1)});
'
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=120, get_pty=True)
print(stdout.read().decode("utf-8", "replace"))
client.close()
