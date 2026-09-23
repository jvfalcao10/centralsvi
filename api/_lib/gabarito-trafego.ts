/**
 * Gabarito e critérios de correção da vaga de tráfego.
 *
 * ESTE ARQUIVO SÓ RODA NO SERVIDOR. Vive em `api/_lib/` de propósito: nada aqui
 * pode ser importado por página React, senão vai parar no bundle e o candidato
 * lê a resposta certa no DevTools. Aconteceu na primeira versão e foi pego na
 * verificação do bundle antes de subir.
 *
 * As chaves casam com os ids de `src/data/vagaTrafego.ts`. Mexeu numa pergunta
 * lá, confere aqui.
 */

/** id da questão → alternativa correta */
export const GABARITO: Record<string, string> = {
  t1: 'b',
  t2: 'b',
  t3: 'c',
  t4: 'b',
  t5: 'b',
  t6: 'b',
}

/** Alternativa defensável: vale 40% do peso, não zero. */
export const PARCIAL: Record<string, string> = {
  t3: 'a',
  t6: 'c',
}

/** O que separa resposta forte de conversa fiada, por pergunta aberta. */
export const CRITERIOS: Record<string, string> = {
  a1: 'Forte: ação específica, tomada por ele, com número antes e depois. Fraco: fala de atitude no geral, sem caso, sem número, ou o mérito é do time.',
  a2: 'Forte: assume sem terceirizar, conta o estrago real e a correção de processo que nasceu dali. Fraco: erro inofensivo disfarçado de erro, culpa do cliente, da plataforma ou do time, ou "nunca errei".',
  a3: 'Forte: fonte concreta e recente, com aplicação real em conta. Fraco: lista de cursos sem aplicação, nome de guru solto, ou nada dos últimos 60 dias.',
  a4: 'Forte: rotina própria de leitura, teste planejado, olhar concorrência, antecipar fadiga ou sazonalidade, propor algo ao cliente. Fraco: "espero o cliente falar", "vejo se está tudo ok", ou só olhar o painel.',
  a5: 'Forte: começa pelo que acontece DEPOIS da conversa (atendimento, tempo de resposta, follow-up) antes de culpar mídia, e pede dado em vez de chutar. Fraco: vai direto pra público ou criativo, ou propõe subir verba.',
}
