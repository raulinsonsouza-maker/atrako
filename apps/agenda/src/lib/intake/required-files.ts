import type { CompanyOpeningBrData, IntakeFileFieldDef } from "@/lib/intake/types";

export function requiredIntakeFileFields(
  data: CompanyOpeningBrData,
): IntakeFileFieldDef[] {
  const fields: IntakeFileFieldDef[] = [];

  data.partners.forEach((partner, index) => {
    fields.push({
      key: `partner_${index}_id_doc`,
      label: `RG ou CNH — ${partner.fullName || `Sócio ${index + 1}`}`,
      hint: "Documento de identidade legível (frente e verso, se aplicável)",
      required: true,
      partnerIndex: index,
    });

    if (!partner.cpfOnIdDoc) {
      fields.push({
        key: `partner_${index}_cpf_doc`,
        label: `CPF — ${partner.fullName || `Sócio ${index + 1}`}`,
        hint: "Comprovante ou documento com CPF legível",
        required: true,
        partnerIndex: index,
      });
    }

    fields.push({
      key: `partner_${index}_address_proof`,
      label: `Comprovante de residência — ${partner.fullName || `Sócio ${index + 1}`}`,
      hint: "Emitido nos últimos 90 dias",
      required: true,
      partnerIndex: index,
    });

    if (
      partner.maritalStatus === "married" ||
      partner.maritalStatus === "stable_union"
    ) {
      fields.push({
        key: `partner_${index}_marriage_cert`,
        label: `Certidão de casamento/união — ${partner.fullName || `Sócio ${index + 1}`}`,
        hint: "Certidão atualizada ou escritura de união estável",
        required: true,
        partnerIndex: index,
      });
    }
  });

  if (data.headquarters.isRented) {
    fields.push({
      key: "company_lease_or_authorization",
      label: "Contrato de locação ou autorização do proprietário",
      hint: "Contrato vigente ou autorização para uso como sede",
      required: true,
    });
  } else {
    fields.push({
      key: "company_iptu_or_property",
      label: "IPTU ou documento do imóvel da sede",
      hint: "Comprovante de propriedade ou IPTU do endereço informado",
      required: true,
    });
  }

  return fields;
}

export function missingRequiredFiles(
  data: CompanyOpeningBrData,
  uploadedKeys: Set<string>,
): IntakeFileFieldDef[] {
  return requiredIntakeFileFields(data).filter(
    (f) => f.required && !uploadedKeys.has(f.key),
  );
}

export function fileFieldLabel(key: string, data: CompanyOpeningBrData): string {
  const match = requiredIntakeFileFields(data).find((f) => f.key === key);
  return match?.label || key;
}
