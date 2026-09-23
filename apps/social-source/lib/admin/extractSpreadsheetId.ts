const SPREADSHEET_ID_REGEX = /\/d\/([a-zA-Z0-9_-]+)/;

/**
 * Extrai o Spreadsheet ID de uma URL do Google Sheets.
 * Ex: https://docs.google.com/spreadsheets/d/1JtPbK_LO5TaStr4vO9-E-nLPcSyJ7m24t_2SgQBXHpI/edit?usp=sharing
 * -> 1JtPbK_LO5TaStr4vO9-E-nLPcSyJ7m24t_2SgQBXHpI
 */
export function extractSpreadsheetId(planilhaUrl: string): string | null {
  const trimmed = planilhaUrl.trim();
  const match = trimmed.match(SPREADSHEET_ID_REGEX);
  return match ? match[1] : null;
}
