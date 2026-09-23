import type { CompanyOpeningBrData, IntakeTemplateDef } from "@/lib/intake/types";

export const COMPANY_OPENING_BR_KEY = "company_opening_br";

export function defaultPartner(): CompanyOpeningBrData["partners"][0] {
  return {
    fullName: "",
    cpf: "",
    rgOrCnh: "",
    birthDate: "",
    nationality: "Brasileira",
    maritalStatus: "single",
    marriageRegime: "",
    profession: "",
    address: "",
    zipCode: "",
    email: "",
    phone: "",
    cpfOnIdDoc: false,
  };
}

export function defaultCompanyOpeningData(): CompanyOpeningBrData {
  return {
    partners: [defaultPartner()],
    companyNameOptions: ["", "", ""],
    tradeName: "",
    preferredLegalName: "",
    shareCapitalReais: "",
    ownership: [{ partnerIndex: 0, percentage: 100 }],
    administration: {
      administratorPartnerIndices: [0],
      mode: "sole",
    },
    activities: "",
    headquarters: {
      address: "",
      zipCode: "",
      isRented: false,
    },
  };
}

export const companyOpeningBrTemplate: IntakeTemplateDef = {
  key: COMPANY_OPENING_BR_KEY,
  title: "Abertura de Empresa",
  maxFileBytes: 5 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  steps: [
    { id: "partners", title: "Sócios", description: "Dados de cada sócio" },
    { id: "company", title: "Empresa", description: "Opções de razão social" },
    { id: "capital", title: "Capital", description: "Capital social" },
    { id: "ownership", title: "Quadro", description: "Participação societária" },
    {
      id: "administration",
      title: "Administração",
      description: "Quem administra a empresa",
    },
    { id: "activities", title: "Atividades", description: "Objeto social" },
    { id: "headquarters", title: "Sede", description: "Endereço da sede" },
    { id: "documents", title: "Documentos", description: "Envio de arquivos" },
    { id: "payment", title: "Pagamento", description: "Finalizar contratação" },
  ],
  defaultData: defaultCompanyOpeningData,
};

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: "Solteiro(a)",
  married: "Casado(a)",
  divorced: "Divorciado(a)",
  widowed: "Viúvo(a)",
  stable_union: "União estável",
};
