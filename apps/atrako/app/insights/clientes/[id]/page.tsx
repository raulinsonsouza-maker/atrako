import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> | { id: string } };

export default async function InsightsClienteDetailRedirect({ params }: Props) {
  const resolved = await Promise.resolve(params);
  redirect(`/clientes/${resolved.id}`);
}
