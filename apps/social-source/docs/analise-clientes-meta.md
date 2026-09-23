# Análise: Clientes existentes vs Contas Meta

## Situação atual (após primeira importação)

### Resumo
- **33 clientes** no total
- **8 clientes originais** (com planilhas Google): Academy Americana, Beblue, Dr Fernando Guena, Hotel fazenda São João, Swiss Park Brasilia, Swiss Park Caieiras, Tertúlia, Varella Motos
- **25 clientes** com Conta META (criados na importação)
- **0 clientes** com ambos (Meta + Sheets) no mesmo registro — houve duplicação

### Duplicados identificados

| Cliente original (Sheets) | Cliente duplicado (Meta) | Ação recomendada |
|---------------------------|--------------------------|------------------|
| Academy Americana (academy-americana) | Academy Americana (academy-americana-1) | Vincular Conta META ao original; remover duplicado |
| Dr Fernando Guena (dr-fernando-guena) | Dr. Fernando Guena (dr-fernando-guena-1) | Vincular Conta META ao original; remover duplicado |
| Tertúlia (tertulia) | Tertúlia (tertulia-1) | Vincular Conta META ao original; remover duplicado |
| Varella Motos (varella-motos) | Varella Motos (varella-motos-1) | Vincular Conta META ao original; remover duplicado |

### Clientes só com Meta (sem planilha)
Be Blue School, Brasília Swiss Park, Casa Basca, Clinica e Spa Vida Natural, Conta Hotel, D'or, ESALQ Jr. Consultoria, Florien FitoAtivos, Granarolo, Melaço de Cana, Miguel Imoveis Anúncio, Raul Souza, Sou + Charitas, Sou + Icaraí, Sou + Itacoa, Sou + Wellness, Swiss Park AGV REAL, Swiss Park Anápolis - NOVA, Swiss Park Caieiras - NOVA, Vito Balducci, Yema.

### Clientes só com Sheets (sem Conta META)
Academy Americana, Beblue, Dr Fernando Guena, Hotel fazenda São João, Swiss Park Brasilia, Swiss Park Caieiras, Tertúlia, Varella Motos.

### Validação Meta nos originais
Os 8 clientes originais **não têm Conta META** vinculada. Eles recebem dados META via:
- Planilhas Google (aba META) — quando configurado
- Ou fallback `META_AD_ACCOUNT_ID` global — um único accountId para todos

Para usar os painéis corretamente por cliente, cada um deve ter sua **Conta META** com `accountIdPlataforma` correto.

---

## Ajustes implementados

1. **Importação inteligente**: ao importar, se o nome da conta Meta coincidir com um cliente existente (por nome ou slug normalizado), a Conta META é **vinculada** ao cliente existente em vez de criar duplicado.
2. **Sem reimportação**: contas já vinculadas (accountId em Conta) são ignoradas.
3. **Novos clientes**: apenas contas Meta sem correspondência criam novo Cliente + Conta.

---

## Corrigir duplicados já criados

Execute o script de merge:

```bash
npm run scripts:merge-duplicados-meta
```

O script:
1. Move a Conta META do cliente duplicado para o original
2. Atualiza FatoMidiaDiario e demais registros para o cliente original
3. Remove os clientes duplicados (academy-americana-1, dr-fernando-guena-1, tertulia-1, varella-motos-1)

Depois, use **Atualizar todos** no admin para re-sincronizar os dados Meta dos clientes originais.
