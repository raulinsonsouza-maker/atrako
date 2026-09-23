import { syncGoogleAdsTodosClientes } from "@/lib/sync/googleAdsApiSync";

async function main() {
  const result = await syncGoogleAdsTodosClientes();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
