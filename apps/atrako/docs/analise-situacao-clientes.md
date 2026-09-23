# Análise da Situação Atual dos Clientes

## 1. Duplicados

**Resultado:** Não há duplicados por nome no banco. O merge anterior (Academy Americana, Dr. Fernando Guena, Tertúlia, Varella Motos) foi concluído com sucesso.

Se a tela ainda mostrar duplicação, pode ser cache do navegador — tente Ctrl+F5 ou abrir em aba anônima.

---

## 2. Clientes "Sem dados"

**Condição:** Um cliente aparece como "Sem dados" quando `totalLeads === 0` e `conversao === 0` em `FatoMidiaDiario`.

**Clientes atualmente sem dados (após análise):**
- Casa Basca
- Melaço de Cana
- Yema

**Possíveis causas:**
- Sync Meta ainda não rodou para essas contas
- Contas Meta sem campanhas ou sem dados no período
- Erro no sync (conta sem permissão, etc.)

**Ação:** Rodar "Atualizar todos" no admin para sincronizar. Se continuar sem dados, conferir se as contas Meta têm campanhas ativas.

---

## 3. Conversão > 100%

**Clientes com conversão acima de 100%:**
- D'or: 139,2%
- Granarolo: 137,4%
- Miguel Imoveis Anúncio: 121,1%
- Vito Balducci: 143,2%

**Motivo:** A conversão é `(leads / cliques) * 100`. Valores > 100% podem ocorrer quando:
- Leads vêm de fontes que não passam por cliques (formulários, WhatsApp, etc.)
- Soma de múltiplos canais (Meta + Google) com métricas diferentes
- Leads orgânicos ou de outras origens

**Ação sugerida:** Limitar a exibição a 100% ou exibir "100%+" para evitar confusão.

---

## 4. Resumo de correções

| Item | Status | Ação |
|------|--------|------|
| Duplicados | OK | Nenhuma |
| Sem dados | 3 clientes | Rodar sync; verificar contas Meta |
| Conversão > 100% | 4 clientes | Ajustar exibição (cap ou "100%+") |
