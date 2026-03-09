
## Plan: Insert real client & lead data

### Summary
- Store EUA clients as USD value (500) — user accepted
- Delete ALL mock data (clients, leads, deliveries, invoices, interactions, expenses)
- Insert 24 real active clients + 5 prospects as leads

### Execution: 3 data operations via insert tool

**Operation 1 — DELETE all mock data**
```sql
DELETE FROM interactions;
DELETE FROM deliveries;
DELETE FROM invoices;
DELETE FROM expenses;
DELETE FROM leads;
DELETE FROM clients;
```

**Operation 2 — INSERT 24 active clients**

Brasil (20):

| Name | Company | Segment | MRR | Plano | Status |
|------|---------|---------|-----|-------|--------|
| Hospital Jordão | Hospital Jordão (Oftalmologia) | saude | 1750 | growth | ativo |
| Dr. Brenno | Medicina da Dor | saude | 1600 | growth | ativo |
| Dr. Daniel Peralba | Cirurgia - Saúde Intestinal | saude | 2000 | growth | ativo |
| Dr. Felipe Branco | Cirurgia Bariátrica | saude | 2000 | growth | ativo |
| Dra. Esia Lopes Xinguara | Pediatria Xinguara | saude | 1750 | growth | ativo |
| Nikolas Fisio | Fisioterapia - Joelho | saude | 2000 | growth | ativo |
| ProLife | Academia de Reabilitação | saude | 2000 | growth | ativo |
| Spa Nature | Spa Nature | estetica | 2000 | growth | ativo |
| Vanessa Back | Vanessa Back Estética | estetica | 1500 | growth | ativo |
| Espaço Soraia | Roupas e Perfumaria | varejo | 2000 | growth | ativo |
| Ótica Central | Ótica Central | varejo | 1750 | growth | ativo |
| Realme | Celulares e Acessórios | varejo | 1800 | growth | ativo |
| Supermercado América | Supermercado América | alimentacao | 2000 | growth | ativo |
| Oficinas Burguer | Oficinas Burguer | alimentacao | 1800 | growth | ativo |
| A Fórmula | Farmácia de Manipulação | servicos | 0 | starter | ativo |
| Números Contabilidade | Números Contabilidade | servicos | 0 | starter | ativo |
| Colégio Christo Rei | Colégio Christo Rei | educacao | 2500 | pro | ativo |
| Exatta Solar | Exatta Solar | energia_agro | 2500 | pro | ativo |
| Aerojet | Aviação Agrícola | energia_agro | 700 | starter | ativo |
| Alpha Fitness | Alpha Fitness | fitness | 2000 | growth | ativo |

EUA (4):

| Name | Company | Segment | MRR | Plano | Notes |
|------|---------|---------|-----|-------|-------|
| MJC Pavers | MJC Pavers (Orlando) | construcao | 500 | starter | USD |
| Ma Pavers | Ma Pavers (Fort Myers) | construcao | 500 | starter | USD |
| Botelho Construction | Botelho Construction (Orlando) | construcao | 500 | starter | USD |
| MJC Kitchen | MJC Kitchen (Móveis) | construcao | 500 | starter | USD |

**Operation 3 — INSERT 5 prospects as leads** (stage: `proposta`)

| Name | Company | Segment | Source | Ticket |
|------|---------|---------|--------|--------|
| Dra. Paula Andrade | adv.paulaandrade | advocacia | organico | 2000 |
| Dr. Deusdete Junior | dr.deusdete_junior | saude | organico | 2000 |
| Norte Capital | nortecapitalai | investimentos | organico | 1400 |
| Bengô Açaí | bengoacai.redencao | alimentacao | organico | 1750 |
| WR Pizzaria | wr_pizzaria19 | alimentacao | organico | 2000 |

### Result after execution
- Dashboard will show real MRR: ~R$33.650/mês Brasil + USD 2.000 EUA
- 24 active clients in Clients page
- 5 prospects in Pipeline at "Proposta" column
- All financial pages start clean (zero invoices/expenses to add manually)
- No code changes needed

### No DB migrations needed — only data operations
