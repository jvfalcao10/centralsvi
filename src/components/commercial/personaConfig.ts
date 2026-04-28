import { CommercialPersonaKey } from '@/types'

export type MetricKey =
  | 'abridores' | 'visualizacoes' | 'conexoes' | 'mapeamentos'
  | 'pre_agendamentos' | 'agendamentos' | 'calls_realizadas' | 'vendas'
  | 'ligacoes' | 'decisores' | 'reunioes_marcadas'
  | 'diag_mkt' | 'diag_comercial'

export interface MetricDef {
  key: MetricKey
  label: string
  goalKey: keyof MetricGoalsRef
}

export interface MetricGoalsRef {
  abridores: number
  visualizacoes: number
  conexoes: number
  mapeamentos: number
  pre_agendamentos: number
  agendamentos: number
  calls_realizadas: number
  vendas: number
  ligacoes: number
  decisores: number
  reunioes_marcadas: number
  diag_mkt_semanal: number
  diag_comercial_semanal: number
}

export const personaMetrics: Record<CommercialPersonaKey, MetricDef[]> = {
  pedro: [
    { key: 'abridores',         label: 'Abridores',          goalKey: 'abridores' },
    { key: 'visualizacoes',     label: 'Visualizações',      goalKey: 'visualizacoes' },
    { key: 'conexoes',          label: 'Conexões',           goalKey: 'conexoes' },
    { key: 'mapeamentos',       label: 'Mapeamentos',        goalKey: 'mapeamentos' },
    { key: 'pre_agendamentos',  label: 'Pré-agendamentos',   goalKey: 'pre_agendamentos' },
    { key: 'agendamentos',      label: 'Agendamentos',       goalKey: 'agendamentos' },
    { key: 'calls_realizadas',  label: 'Calls realizadas',   goalKey: 'calls_realizadas' },
    { key: 'vendas',            label: 'Vendas',             goalKey: 'vendas' },
  ],
  arthur: [
    { key: 'ligacoes',          label: 'Ligações',           goalKey: 'ligacoes' },
    { key: 'conexoes',          label: 'Conexões',           goalKey: 'conexoes' },
    { key: 'decisores',         label: 'Decisores',          goalKey: 'decisores' },
    { key: 'reunioes_marcadas', label: 'Reuniões marcadas',  goalKey: 'reunioes_marcadas' },
  ],
  ruan: [
    { key: 'diag_mkt',          label: 'Diagnósticos MKT',         goalKey: 'diag_mkt_semanal' },
    { key: 'diag_comercial',    label: 'Diagnósticos Comercial',   goalKey: 'diag_comercial_semanal' },
  ],
}

/** Ruan's goals are weekly — multiply by 4 for monthly target. */
export const monthlyGoal = (persona: CommercialPersonaKey, weeklyOrMonthly: number) =>
  persona === 'ruan' ? weeklyOrMonthly * 4 : weeklyOrMonthly
