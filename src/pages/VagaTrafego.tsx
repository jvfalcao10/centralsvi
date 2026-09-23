import { useMemo, useState } from 'react'
import { TECNICAS, ABERTAS, FAIXAS_VERBA, FAIXAS_CONTAS, VERTICAIS } from '@/data/vagaTrafego'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

/**
 * Formulário público da vaga de gestor de tráfego.
 * Sem login e sem menu: é a página que o candidato abre.
 *
 * Em 3 passos de propósito. Uma página só com 20 campos faz o candidato
 * desistir no meio, e quem responde com pressa entrega texto raso, que é
 * justamente o que a correção precisa avaliar.
 * O gabarito NÃO vem pra cá: `correta` só é lido no servidor.
 */
export default function VagaTrafego() {
  const [passo, setPasso] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')
  const [f, setF] = useState<Record<string, any>>({ verticais: [], aceita_pj: true })
  const [r, setR] = useState<Record<string, string>>({})

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const resp = (k: string, v: string) => setR(p => ({ ...p, [k]: v }))

  const faltaPasso0 = !f.nome?.trim() || String(f.whatsapp || '').replace(/\D/g, '').length < 10 || !f.cidade?.trim()
  const faltaPasso1 = TECNICAS.some(q => !r[q.id])
  const curtas = useMemo(() => ABERTAS.filter(q => String(r[q.id] || '').trim().length < 40), [r])

  async function enviar() {
    setEnviando(true); setErro('')
    try {
      const res = await fetch('/api/vaga-trafego', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, respostas: r }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'falhou')
      setPronto(true)
    } catch (e: any) {
      setErro('Não conseguimos enviar agora. Confere sua conexão e tenta de novo em alguns segundos.')
    } finally { setEnviando(false) }
  }

  if (pronto) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
        <h1 className="text-2xl font-bold">Recebemos sua candidatura</h1>
        <p className="text-muted-foreground">
          Obrigado pelo tempo, {String(f.nome || '').split(' ')[0]}. Vamos ler com atenção e, se fizer sentido,
          chamamos você no WhatsApp pra conversar.
        </p>
        <p className="text-sm text-muted-foreground">SVI Company · Redenção, Pará</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">SVI Company · vaga aberta</p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Gestor de tráfego</h1>
          <p className="text-muted-foreground">
            Agência multivertical no sul do Pará, carteira com médico, clínica, solar e varejo.
            Começa em R$ 2.000 por mês e cresce por entrega, não por tempo de casa.
          </p>
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium">Como funciona a entrada</p>
            <p className="text-muted-foreground">
              O primeiro mês é de teste, com contas reais e combinado claro do que é entregar bem.
              Passou no mês, segue efetivo. É PJ, com nota.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            São três passos e leva uns 15 minutos. As perguntas abertas são o que mais pesa aqui,
            então responde com caso real e número. Resposta genérica não passa.
          </p>
        </header>

        <div className="flex gap-1.5">
          {['Você', 'Situações', 'Sobre você'].map((nome, i) => (
            <div key={nome} className="flex-1 space-y-1">
              <div className={`h-1 rounded-full ${i <= passo ? 'bg-primary' : 'bg-muted'}`} />
              <p className={`text-[11px] ${i === passo ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{nome}</p>
            </div>
          ))}
        </div>

        {passo === 0 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-nome">Nome completo *</Label>
                <Input id="v-nome" value={f.nome || ''} onChange={e => set('nome', e.target.value)} maxLength={90} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-wpp">WhatsApp *</Label>
                <Input id="v-wpp" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)}
                  placeholder="(94) 99999-9999" inputMode="tel" maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-cid">Cidade onde mora *</Label>
                <Input id="v-cid" value={f.cidade || ''} onChange={e => set('cidade', e.target.value)} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-mail">E-mail</Label>
                <Input id="v-mail" type="email" value={f.email || ''} onChange={e => set('email', e.target.value)} maxLength={90} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-anos">Anos gerindo tráfego</Label>
                <Input id="v-anos" type="number" min={0} max={30} value={f.anos_experiencia || ''}
                  onChange={e => set('anos_experiencia', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-verba">Maior verba mensal que você já geriu</Label>
                <select id="v-verba" value={f.verba_gerida || ''} onChange={e => set('verba_gerida', e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Selecione</option>
                  {FAIXAS_VERBA.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-contas">Contas ao mesmo tempo</Label>
                <select id="v-contas" value={f.contas_simultaneas || ''} onChange={e => set('contas_simultaneas', e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Selecione</option>
                  {FAIXAS_CONTAS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-prova">Link de prova (case, portfólio, print de conta)</Label>
                <Input id="v-prova" value={f.link_prova || ''} onChange={e => set('link_prova', e.target.value)}
                  placeholder="https://" maxLength={300} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Em que tipo de cliente você já rodou</Label>
              <div className="flex flex-wrap gap-2">
                {VERTICAIS.map(v => {
                  const on = (f.verticais || []).includes(v)
                  return (
                    <button key={v} type="button"
                      onClick={() => set('verticais', on ? f.verticais.filter((x: string) => x !== v) : [...(f.verticais || []), v])}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}>
                      {v}
                    </button>
                  )
                })}
              </div>
            </div>
            <Button className="w-full gap-2" disabled={faltaPasso0} onClick={() => { setPasso(1); window.scrollTo(0, 0) }}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
            {faltaPasso0 && <p className="text-xs text-muted-foreground text-center">Preencha nome, WhatsApp e cidade pra seguir.</p>}
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Situações reais de conta. Escolhe o que você faria de verdade, não o que parece bonito.
            </p>
            {TECNICAS.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-sm font-medium">{i + 1}. {q.pergunta}</p>
                <div className="space-y-2">
                  {q.alternativas.map(a => (
                    <button key={a.id} type="button" onClick={() => resp(q.id, a.id)}
                      className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors ${r[q.id] === a.id ? 'bg-primary/10 border-primary/40' : 'border-border hover:bg-muted/30'}`}>
                      {a.texto}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPasso(0); window.scrollTo(0, 0) }} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button className="flex-1 gap-2" disabled={faltaPasso1} onClick={() => { setPasso(2); window.scrollTo(0, 0) }}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {faltaPasso1 && <p className="text-xs text-muted-foreground text-center">Responde todas pra seguir.</p>}
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              A parte que mais pesa. Caso real, com número, vale muito mais que texto bonito.
            </p>
            {ABERTAS.map((q, i) => {
              const txt = String(r[q.id] || '')
              return (
                <div key={q.id} className="space-y-1.5">
                  <Label htmlFor={`ab-${q.id}`}>{i + 1}. {q.pergunta}</Label>
                  <p className="text-xs text-muted-foreground">{q.ajuda}</p>
                  <Textarea id={`ab-${q.id}`} rows={4} value={txt} onChange={e => resp(q.id, e.target.value)}
                    maxLength={2500} className="resize-none" />
                  <p className={`text-[11px] ${txt.trim().length < 40 ? 'text-muted-foreground' : 'text-success'}`}>
                    {txt.trim().length < 40 ? `faltam ${40 - txt.trim().length} caracteres` : 'ok'}
                  </p>
                </div>
              )
            })}
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-disp">Disponibilidade</Label>
                <select id="v-disp" value={f.disponibilidade || ''} onChange={e => set('disponibilidade', e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Selecione</option>
                  <option>Integral</option><option>Meio período</option><option>Por demanda</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-pret">Sua pretensão (a vaga começa em R$ 2.000)</Label>
                <Input id="v-pret" value={f.pretensao || ''} onChange={e => set('pretensao', e.target.value)} maxLength={60} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!f.aceita_pj} onChange={e => set('aceita_pj', e.target.checked)} className="accent-primary" />
              Topo trabalhar como PJ, emitindo nota
            </label>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPasso(1); window.scrollTo(0, 0) }} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button className="flex-1 gap-2" disabled={enviando || curtas.length > 0} onClick={enviar}>
                {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : 'Enviar candidatura'}
              </Button>
            </div>
            {curtas.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Faltam {curtas.length} resposta(s) com pelo menos 40 caracteres.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
