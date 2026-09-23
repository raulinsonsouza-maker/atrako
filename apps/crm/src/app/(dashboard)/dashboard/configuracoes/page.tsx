import Link from "next/link";
import { getDashboardContext } from "@/lib/dashboard-context";
import { ThemeSection } from "@/components/features/ThemeSection";
import { BrandingSection } from "@/components/features/BrandingSection";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { WebhookAndAutomationsSection } from "@/components/features/WebhookAndAutomationsSection";
import { MessageTemplatesSection } from "@/components/features/MessageTemplatesSection";
import { WhatsAppIntegrationForm } from "@/components/features/WhatsAppIntegrationForm";
import { UsersSection } from "@/components/features/UsersSection";
import { GoogleCalendarIntegration } from "@/components/features/GoogleCalendarIntegration";
import { TagsSection } from "@/components/features/TagsSection";
import { CustomFieldsSection } from "@/components/features/CustomFieldsSection";
import { AutomationsSection } from "@/components/features/AutomationsSection";
import { LossReasonsSection } from "@/components/features/LossReasonsSection";
import { PipelineConfigSection } from "@/components/features/PipelineConfigSection";
import { PermissionsSection } from "@/components/features/PermissionsSection";
import { getTenantBillingInfo } from "@/server/actions/billing";
import { getTenantBranding } from "@/server/actions/tenant";
import { BillingView } from "../billing/BillingView";

export default async function ConfiguracoesPage() {
  const { session, tenantId } = await getDashboardContext();
  const isAdmin = (session.user as { role?: string }).role === "TENANT_ADMIN";
  const billingInfo = await getTenantBillingInfo(tenantId);
  const email = (session.user as { email?: string }).email ?? "";
  const branding = await getTenantBranding(tenantId);

  return (
    <div className="max-w-2xl space-y-8">
      <ThemeSection />
      <Card>
        <CardHeader>
          <CardTitle>SDR IA</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            Configure identidade, tom de voz, regras de atendimento, qualificação, handoff humano, horários e segurança do SDR.
          </p>
          <Link
            href="/dashboard/configuracoes/sdr"
            className="inline-flex items-center gap-2 rounded-sm bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Configurar SDR IA
          </Link>
        </CardContent>
      </Card>
      {isAdmin && (
        <BrandingSection
          tenantId={tenantId}
          initialName={branding.name}
          initialLogoUrl={branding.logoUrl}
        />
      )}
      {isAdmin && <TagsSection tenantId={tenantId} />}
      {isAdmin && <CustomFieldsSection tenantId={tenantId} />}
      {isAdmin && <AutomationsSection tenantId={tenantId} />}
      {isAdmin && <LossReasonsSection tenantId={tenantId} />}
      {isAdmin && <PipelineConfigSection tenantId={tenantId} />}
      {isAdmin && <PermissionsSection tenantId={tenantId} />}
      <GoogleCalendarIntegration tenantId={tenantId} />
      <WhatsAppIntegrationForm tenantId={tenantId} />
      {billingInfo && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Assinatura</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Gerencie seu plano e cobrança.</p>
          <BillingView
            tenantId={billingInfo.id}
            plan={billingInfo.plan}
            hasStripeCustomer={!!billingInfo.stripeCustomerId}
            userEmail={email}
          />
        </div>
      )}
      <MessageTemplatesSection tenantId={tenantId} />
      {isAdmin && <WebhookAndAutomationsSection tenantId={tenantId} />}
      {isAdmin ? (
        <UsersSection tenantId={tenantId} />
      ) : (
        <p className="text-sm text-neutral-500">Gerencie usuários com uma conta de administrador do tenant.</p>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Documentação da API</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            Documentação completa da API REST para integração com o sistema CRM.
          </p>
          <Link
            href="/dashboard/api-docs"
            className="inline-flex items-center gap-2 rounded-sm bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Ver Documentação da API
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
