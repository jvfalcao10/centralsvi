import { Fragment, type ReactNode } from 'react'

// Marcações aceitas nos campos das lâminas (sem HTML, para o JSON colado nunca injetar nada):
//   **negrito**   ==destaque==   Enter = quebra de linha
// O destaque vira a caixa dourada no T7, o itálico dourado no T8 e fica sem cor no T5.

type Peca = { texto: string; negrito: boolean; destaque: boolean }

function pecas(texto: string): Peca[] {
  const out: Peca[] = []
  let negrito = false
  let destaque = false
  for (const parte of texto.split(/(\*\*|==)/)) {
    if (parte === '**') { negrito = !negrito; continue }
    if (parte === '==') { destaque = !destaque; continue }
    if (parte) out.push({ texto: parte, negrito, destaque })
  }
  return out
}

/** Texto sem as marcações, para contar caracteres e revisar. */
export function textoLimpo(texto: string | undefined | null): string {
  return (texto || '').replace(/\*\*|==/g, '')
}

export interface OpcoesRico {
  /** Elemento usado no destaque (padrão: mark). */
  destaque?: (conteudo: ReactNode, chave: string) => ReactNode
  /** Elemento usado no negrito (padrão: b). */
  negrito?: (conteudo: ReactNode, chave: string) => ReactNode
}

/** Converte uma linha com marcações em nós React, quebrando linhas com <br>. */
export function rico(texto: string | undefined | null, opcoes: OpcoesRico = {}): ReactNode {
  if (!texto) return null
  const linhas = texto.replace(/\r/g, '').split('\n')
  const destaque = opcoes.destaque ?? ((c, k) => <mark key={k}>{c}</mark>)
  const negrito = opcoes.negrito ?? ((c, k) => <b key={k}>{c}</b>)
  // A marcação pode atravessar a quebra de linha (==linha 1\nlinha 2==): processa o texto todo
  // e quebra dentro da peça (o destaque de duas linhas vira uma caixa só, como no motor Python).
  const nos: ReactNode[] = []
  pecas(linhas.join('\n')).forEach((p, i) => {
    const partes = p.texto.split('\n')
    const miolo: ReactNode[] = []
    partes.forEach((trecho, j) => {
      if (j > 0) miolo.push(<br key={`br-${i}-${j}`} />)
      if (trecho) miolo.push(<Fragment key={`t-${i}-${j}`}>{trecho}</Fragment>)
    })
    let no: ReactNode = miolo
    if (p.negrito) no = negrito(no, `n-${i}`)
    if (p.destaque) no = destaque(no, `d-${i}`)
    nos.push(<Fragment key={`p-${i}`}>{no}</Fragment>)
  })
  return nos
}

/** Parágrafos separados por linha em branco. */
export function paragrafos(texto: string | undefined | null): string[] {
  return (texto || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

/** Itens de um campo de lista (um por linha). */
export function itens(texto: string | undefined | null): string[] {
  return (texto || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)
}
