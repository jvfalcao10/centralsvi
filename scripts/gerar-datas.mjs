#!/usr/bin/env node
/**
 * Gera public/datas.json a partir de data/datas-fonte.json.
 *
 * Por que existe: até 20/08/2026 havia DUAS listas de datas mantidas à mão (esta e o
 * mapa NICHO do workflow do dia 20 no n8n). Elas divergiam, e datas de nicho passavam
 * batido — foi o caso do Dia do Psiquiatra em 13/08. Agora a fonte é uma só: aqui se
 * escreve a ESPECIALIDADE que a data serve, e o gerador resolve quais clientes são.
 *
 * Cliente novo entra em UM lugar: o bloco "clientes" da fonte.
 *
 * Uso: npm run datas
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = resolve(raiz, 'data/datas-fonte.json');
const SAIDA = resolve(raiz, 'public/datas.json');
const COPIA = resolve(raiz, 'public/datas-fonte.json'); // o n8n lê esta pela URL

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const erros = [];
const fonte = JSON.parse(readFileSync(FONTE, 'utf8'));
const { clientes, faixas, datas } = fonte;

if (!clientes || !datas) {
  console.error('fonte inválida: faltam as chaves "clientes" ou "datas"');
  process.exit(1);
}

const vistos = new Set();
const eventos = [];

for (const [i, d] of datas.entries()) {
  const onde = `${d.dm || '??'} "${d.nome || 'sem nome'}" (índice ${i})`;

  if (!/^\d{2}\/\d{2}$/.test(d.dm || '')) { erros.push(`${onde}: dm precisa ser DD/MM`); continue; }
  const mes = Number(d.dm.split('/')[1]);
  if (mes < 1 || mes > 12) { erros.push(`${onde}: mês inválido`); continue; }

  const chave = `${d.dm}|${d.nome}`;
  if (vistos.has(chave)) { erros.push(`${onde}: duplicada`); continue; }
  vistos.add(chave);

  // esp -> clientes, sem repetir, mantendo a ordem de declaração
  const cli = [];
  for (const e of d.esp || []) {
    if (!clientes[e]) { erros.push(`${onde}: especialidade "${e}" não existe no bloco clientes`); continue; }
    for (const c of clientes[e]) if (!cli.includes(c)) cli.push(c);
  }
  for (const c of d.cli || []) if (!cli.includes(c)) cli.push(c);

  if (cli.length === 0) { erros.push(`${onde}: ficaria sem nenhum cliente`); continue; }

  eventos.push({
    dm: d.dm,
    mes: MESES[mes - 1],
    cat: d.cat || 'com',
    nome: d.nome,
    ty: d.ty || '',
    cli,
    ...(d.note ? { note: d.note } : {}),
  });
}

if (erros.length) {
  console.error(`\n✖ ${erros.length} problema(s) na fonte. Nada foi gerado:\n`);
  for (const e of erros) console.error('  - ' + e);
  process.exit(1);
}

eventos.sort((a, b) => {
  const [da, ma] = a.dm.split('/').map(Number);
  const [db, mb] = b.dm.split('/').map(Number);
  return ma - mb || da - db || a.nome.localeCompare(b.nome, 'pt-BR');
});

const hoje = new Date().toISOString().slice(0, 10);
writeFileSync(SAIDA, JSON.stringify({ atualizado: hoje, faixas: faixas || {}, eventos }, null, 2) + '\n');
writeFileSync(COPIA, JSON.stringify(fonte, null, 1) + '\n');

const porMes = {};
for (const e of eventos) porMes[e.mes] = (porMes[e.mes] || 0) + 1;
const vazios = MESES.filter((m) => !porMes[m]);

console.log(`✓ ${eventos.length} eventos gerados em public/datas.json`);
console.log('  por mês:', MESES.map((m) => `${m.slice(0,3)} ${porMes[m] || 0}`).join(' · '));
if (vazios.length) console.log('  ⚠️  meses sem nenhuma data:', vazios.join(', '));
