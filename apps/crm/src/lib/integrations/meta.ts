/**
 * Meta Marketing API – Lead Ads.
 * Integration.config: { accessToken, pageId }
 */

type MetaConfig = { accessToken: string; pageId: string };

export type MetaLead = { name: string; email: string; phone?: string; sourceId: string };

export async function getLeads(config: MetaConfig): Promise<MetaLead[]> {
  const { accessToken, pageId } = config;
  if (!accessToken || !pageId) return [];

  const out: MetaLead[] = [];
  try {
    const formsRes = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!formsRes.ok) return [];
    const formsJson = await formsRes.json();
    const forms = formsJson?.data ?? [];

    for (const form of forms) {
      const id = form.id as string;
      const leadsRes = await fetch(
        `https://graph.facebook.com/v18.0/${id}/leads?access_token=${encodeURIComponent(accessToken)}`
      );
      if (!leadsRes.ok) continue;
      const leadsJson = await leadsRes.json();
      const leads = leadsJson?.data ?? [];
      for (const l of leads) {
        const fid = l.id as string;
        const field: Record<string, string> = {};
        for (const f of l.field_data ?? []) {
          field[(f.name as string)?.toLowerCase() ?? ""] = String(f.values?.[0] ?? "");
        }
        const name = [field.full_name, field.name, field.first_name, "Contato"].find(Boolean) ?? "Contato";
        const email = field.email || field.e_mail || `meta-${fid}@placeholder.local`;
        const phone = field.phone_number || field.phone || undefined;
        out.push({ name, email, phone, sourceId: fid });
      }
    }
  } catch {
    // ignore
  }
  return out;
}
