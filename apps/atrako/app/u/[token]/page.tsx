import { prisma } from "@/lib/db";
import { parseUnsubscribeToken } from "@/lib/flows/tracking";
import { loadBrandBase } from "@/lib/flows/theme";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const parsed = parseUnsubscribeToken(token);
  const contact = parsed
    ? await prisma.nativeContact.findFirst({
        where: { id: parsed.contactId, clienteId: parsed.clienteId },
        select: { email: true, emailOptOutAt: true },
      })
    : null;
  const brand = parsed ? await loadBrandBase(parsed.clienteId) : null;
  const accent = brand?.base.colors.accent ?? "#0066cc";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--canvas-parchment)] p-6">
      <div className="w-full max-w-md rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-8 text-center">
        {brand?.base.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.base.logoUrl} alt={brand.storeName} className="mx-auto mb-6 h-10 w-auto" />
        ) : (
          <p className="mb-6 type-tagline text-[var(--ink)]">{brand?.storeName ?? ""}</p>
        )}
        {!contact ? (
          <p className="type-body text-[var(--ink-muted-80)]">Link inválido ou expirado.</p>
        ) : done || contact.emailOptOutAt ? (
          <>
            <p className="type-tagline text-[var(--ink)]">Pronto, você foi descadastrado.</p>
            <p className="mt-2 type-caption text-[var(--ink-muted-48)]">
              {contact.email ? `${contact.email} não receberá mais e-mails de marketing.` : null}
            </p>
          </>
        ) : (
          <form method="post" action={`/u/${token}/confirm`} className="space-y-4">
            <p className="type-tagline text-[var(--ink)]">Não quer mais receber nossos e-mails?</p>
            <p className="type-caption text-[var(--ink-muted-48)]">
              {contact.email ? `Vamos parar os envios para ${contact.email}.` : null}
            </p>
            <label className="flex items-center justify-center gap-2 type-caption text-[var(--ink-muted-80)]">
              <input type="checkbox" name="whatsapp" value="1" />
              Parar também as mensagens de WhatsApp
            </label>
            <button
              type="submit"
              className="w-full rounded-[var(--radius-xs)] px-5 py-3 type-body text-white active:scale-95"
              style={{ background: accent }}
            >
              Confirmar descadastro
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
