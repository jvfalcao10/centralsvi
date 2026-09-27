import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AGENTES, FRAMEWORKS, type Agente, type EntradaAgente } from '@/data/criador/agentes'
import { TEMPLATES, TEMPLATE_POR_ID } from '@/data/criador/templates'
import type { Formato, TemplateId } from '@/data/criador/tipos'

export async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Safari antigo ou contexto sem permissão: cai no textarea escondido
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

function CartaoAgente({ agente, entrada, ordem }: { agente: Agente; entrada: EntradaAgente; ordem: number }) {
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const prompt = useMemo(() => agente.montar(entrada), [agente, entrada])
  const copiar = async () => {
    const ok = await copiarTexto(prompt)
    if (ok) { setCopiado(true); toast.success(`Prompt do ${agente.nome} copiado. Cole no ChatGPT ou no Claude.`); setTimeout(() => setCopiado(false), 2000) }
    else toast.error('Não consegui copiar. Abra "Ver prompt" e copie à mão.')
  }
  return <article className="rounded-xl border bg-card p-3 sm:p-4 space-y-2 min-w-0">
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">{ordem}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="font-semibold">{agente.nome}</h3>
        <p className="text-sm">{agente.papel}</p>
        <p className="text-xs text-muted-foreground"><b className="font-medium text-foreground">Quando:</b> {agente.quandoUsar}</p>
        <p className="text-xs text-muted-foreground"><b className="font-medium text-foreground">Material:</b> {agente.pedeMaterial}</p>
        <p className="text-xs text-muted-foreground"><b className="font-medium text-foreground">Devolve:</b> {agente.devolve}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={copiar}>{copiado ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}Copiar prompt</Button>
      <Button size="sm" variant="outline" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
        {aberto ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}Ver prompt
      </Button>
      <span className="self-center text-[11px] text-muted-foreground tabular-nums">{prompt.length.toLocaleString('pt-BR')} caracteres</span>
    </div>
    {aberto && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs leading-relaxed">{prompt}</pre>}
  </article>
}

export function AbaAgentes({ templateInicial, formatoInicial = 'carrossel' }: { templateInicial: TemplateId; formatoInicial?: Formato }) {
  const [tema, setTema] = useState('')
  const [template, setTemplate] = useState<TemplateId>(templateInicial)
  const [frameworkId, setFrameworkId] = useState(templateInicial === 't10' ? 'editorial' : templateInicial === 't9' ? 'reflexao' : templateInicial === 't8' ? 'H' : 'storybrand')
  const [laminas, setLaminas] = useState(TEMPLATE_POR_ID[templateInicial].estrutura.length)
  const [material, setMaterial] = useState('')
  const [formato, setFormato] = useState<Formato>(formatoInicial === 'estatico' && TEMPLATE_POR_ID[templateInicial].estatico ? 'estatico' : 'carrossel')
  const temEstatico = !!TEMPLATE_POR_ID[template].estatico
  const fmt: Formato = temEstatico ? formato : 'carrossel'
  const framework = FRAMEWORKS.find(f => f.id === frameworkId) ?? FRAMEWORKS[0]
  const entrada: EntradaAgente = useMemo(() => ({ tema, template: TEMPLATE_POR_ID[template], framework, laminas: fmt === 'estatico' ? 1 : laminas, material, formato: fmt }), [tema, template, framework, laminas, material, fmt])

  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Cada agente é um prompt pronto com o conhecimento da casa embutido. Preencha, copie, cole no ChatGPT ou no Claude e traga a resposta. O JSON do Roteirista e do Revisor vai direto na aba Montar. Custo de API na Central: zero.</p>
    <section className="rounded-xl border bg-card p-3 sm:p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <Label htmlFor="cz-tema">Tema</Label>
        <Input id="cz-tema" value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex.: o paciente que pesquisa às 22h e marca com quem responde primeiro" />
      </div>
      <div className="space-y-1.5">
        <Label>Template</Label>
        <Select value={template} onValueChange={v => { setTemplate(v as TemplateId); setLaminas(TEMPLATE_POR_ID[v as TemplateId].estrutura.length) }}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.codigo} · {t.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Formato</Label>
        <Select value={fmt} onValueChange={v => setFormato(v as Formato)} disabled={!temEstatico}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="carrossel">Carrossel</SelectItem>{temEstatico && <SelectItem value="estatico">Estático (peça única)</SelectItem>}</SelectContent>
        </Select>
        {!temEstatico && <p className="text-[11px] text-muted-foreground">Estático existe no T9 e no T10.</p>}
      </div>
      {fmt === 'carrossel' && <><div className="space-y-1.5 sm:col-span-1 lg:col-span-1">
        <Label>Framework ou estrutura</Label>
        <Select value={frameworkId} onValueChange={v => { setFrameworkId(v); const f = FRAMEWORKS.find(x => x.id === v); if (f) setLaminas(f.laminas) }}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{FRAMEWORKS.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{framework.descricao}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cz-laminas">Número de lâminas</Label>
        <Input id="cz-laminas" type="number" min={1} max={20} value={laminas} onChange={e => setLaminas(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
      </div></>}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <Label htmlFor="cz-material">Material de entrada (pauta, copy ou JSON, depende do agente)</Label>
        <Textarea id="cz-material" rows={4} value={material} onChange={e => setMaterial(e.target.value)} placeholder="Opcional. O que colar aqui vai dentro do prompt, no bloco <material>." />
      </div>
    </section>
    <div className="grid gap-3 lg:grid-cols-2">
      {AGENTES.map((a, i) => <CartaoAgente key={a.id} agente={a} entrada={entrada} ordem={i + 1} />)}
    </div>
  </div>
}
