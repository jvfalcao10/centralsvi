// Tipos do Criador de Carrossel (27/09/2026).
// A Central não chama IA: os agentes são prompts prontos, a resposta volta em JSON
// e vira lâminas pelos componentes de src/components/criador/templates.

export type TemplateId = 't5' | 't6' | 't7' | 't8' | 't9' | 't10'

export type TipoCampo = 'texto' | 'lista' | 'opcao'

export interface Campo {
  chave: string
  rotulo: string
  /** Limite de caracteres (sem contar as marcações ** e ==). Em lista, vale por item. */
  limite: number
  tipo?: TipoCampo
  multiline?: boolean
  obrigatorio?: boolean
  /** Lista: quantidade máxima de itens. */
  maxItens?: number
  opcoes?: { valor: string; rotulo: string }[]
  padrao?: string
  ajuda?: string
}

export interface FotoCampo {
  chave: string
  rotulo: string
  obrigatoria: boolean
  /** Proporção em que a foto deve ser gerada ou escolhida (largura x altura da vaga). */
  proporcao: string
  /** Foco padrão (object-position em %). */
  foco: [number, number]
}

export interface SlideType {
  tipo: string
  nome: string
  descricao: string
  campos: Campo[]
  usaFoto: boolean
  fotos: FotoCampo[]
}

export interface FotoSlide {
  /** Caminho no bucket privado criador-carrossel. */
  path?: string
  /** URL direta (amostras do próprio app ou blob local antes de subir). */
  url?: string
  /** Foco horizontal e vertical em % (object-position). */
  x: number
  y: number
  /** Zoom sobre o enquadramento (1 = foto inteira na vaga, até 2). Serve para o quadro fechado do T9. */
  z?: number
  /** T10: cabeças marcadas pelo João (caixas normalizadas 0..1: x0, y0, x1, y1). Com elas o enquadramento é automático. */
  cab?: [number, number, number, number][]
  /** T10: área útil da foto (sem legenda ou letreiro gravado), normalizada. Padrão: a foto inteira. */
  util?: [number, number, number, number]
  /** Tamanho natural da foto (medido ao marcar o rosto). */
  w?: number
  h?: number
}

export interface SlideDoc {
  id: string
  tipo: string
  campos: Record<string, string>
  /** Descrição da foto pedida pelo agente (Diretor de foto ou Roteirista). */
  foto?: string
  fotos: Record<string, FotoSlide>
}

export type Formato = 'carrossel' | 'estatico'

export interface OpcoesCarrossel {
  /** Carrossel (várias lâminas) ou estático (peça única, exporta um PNG só). */
  formato?: Formato
  /** T5 e T6: fundo do card. */
  fundo?: 'preto' | 'branco'
  /** Assinatura "Método AORTA" no pé de cada lâmina. */
  assinatura: boolean
  /** T10: texto do rodapé na última lâmina (ex.: "Setembro, ©2026"). */
  dataRodape?: string
}

export interface CarrosselDoc {
  id?: string
  titulo: string
  template: TemplateId
  legenda: string
  slides: SlideDoc[]
  opcoes: OpcoesCarrossel
}

export interface TemplateDef {
  id: TemplateId
  codigo: string
  nome: string
  origem: string
  quandoUsar: string
  uso?: string
  /** Sequência sugerida de tipos de lâmina (ordem padrão). */
  estrutura: string[]
  slideTypes: SlideType[]
  fundoPadrao?: 'preto' | 'branco'
  assinaturaPadrao: boolean
  /** Conteúdo de exemplo para a galeria e para o botão "Carregar exemplo". */
  exemplo: Omit<SlideDoc, 'id'>[]
  /** Peça única (estático) no mesmo visual, quando o template suporta. */
  estatico?: EstaticoDef
}

export interface EstaticoDef {
  nome: string
  quandoUsar: string
  /** Tipo de lâmina usado na peça única. */
  tipo: string
  exemplo: Omit<SlideDoc, 'id'>
}
