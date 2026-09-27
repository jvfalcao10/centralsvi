import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle, ScanFace, ArrowDown, ArrowUp, CheckCircle2, ClipboardPaste, Copy, CopyPlus, Download, FilePlus2, ImagePlus,
  Loader2, Save, Trash2, X, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TEMPLATES, TEMPLATE_POR_ID } from '@/data/criador/templates'
import type { Campo, CarrosselDoc, FotoCampo, FotoSlide, SlideDoc, TemplateId } from '@/data/criador/tipos'
import { lerJsonDoAgente, novoId, paraJsonDoAgente } from '@/lib/criador/contrato'
import { focoPadrao, novoDoc, novoSlide, opcoesPadrao } from '@/lib/criador/doc'
import { revisar, temBloqueio, type Achado } from '@/lib/criador/revisor'
import { itens, textoLimpo } from '@/lib/criador/texto'
import { exportarZip } from '@/lib/criador/exportar'
import { esperarFontes } from '@/lib/criador/fontes'
import { carregarRascunho, excluirRascunho, listarRascunhos, salvarRascunho, subirFoto, urlsAssinadas } from '@/lib/criador/armazenamento'
import { estiloZoom, FotoContext } from './templates/comum'
import { SlideCanvas, SlidePreview } from './templates'
import { PreviewAjustado } from './PreviewAjustado'
import { MarcarRosto } from './MarcarRosto'
import { RelatorioT10Context, type RelatorioT10 } from './templates/T10Editorial'
import { copiarTexto } from './AbaAgentes'

interface Props {
  doc: CarrosselDoc
  setDoc: (fn: (d: CarrosselDoc) => CarrosselDoc) => void
  substituirDoc: (d: CarrosselDoc) => void
}

// ─────────── campo de texto com contador ───────────
function CampoEditor({ campo, valor, aoMudar }: { campo: Campo; valor: string; aoMudar: (v: string) => void }) {
  const id = useMemo(() => `cz-${novoId()}`, [])
  if (campo.tipo === 'opcao') {
    return <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{campo.rotulo}</Label>
      <Select value={valor || campo.padrao || campo.opcoes?.[0]?.valor} onValueChange={aoMudar}>
        <SelectTrigger id={id} className="w-full h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{campo.opcoes?.map(o => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  }
  const lista = campo.tipo === 'lista'
  const n = textoLimpo(valor).length
  const itensLista = lista ? itens(valor) : []
  const maiorItem = lista ? Math.max(0, ...itensLista.map(i => textoLimpo(i).length)) : 0
  const estourou = lista ? maiorItem > campo.limite || (campo.maxItens ? itensLista.length > campo.maxItens : false) : n > campo.limite
  const contador = lista ? `${itensLista.length}/${campo.maxItens ?? '∞'} itens · maior ${maiorItem}/${campo.limite}` : `${n}/${campo.limite}`
  const multi = campo.multiline || lista || campo.limite > 90
  return <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={id} className="text-xs">{campo.rotulo}{campo.obrigatorio ? ' *' : ''}</Label>
      <span className={`text-[11px] tabular-nums ${estourou ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{contador}</span>
    </div>
    {multi
      ? <Textarea id={id} value={valor} onChange={e => aoMudar(e.target.value)} rows={lista ? Math.min(6, Math.max(3, itensLista.length + 1)) : Math.min(5, Math.max(2, Math.ceil(campo.limite / 70)))}
        className={`text-sm ${estourou ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
      : <Input id={id} value={valor} onChange={e => aoMudar(e.target.value)} className={`h-9 text-sm ${estourou ? 'border-destructive focus-visible:ring-destructive' : ''}`} />}
    {campo.ajuda && <p className="text-[11px] text-muted-foreground">{campo.ajuda}</p>}
  </div>
}

// ─────────── foto por vaga: subir, foco X/Y, remover ───────────
function FotoEditor({ def, foto, src, subindo, marcaRosto, aoSubir, aoMudar, aoRemover }: {
  def: FotoCampo; foto?: FotoSlide; src?: string; subindo: boolean; marcaRosto: boolean
  aoSubir: (f: File) => void; aoMudar: (f: FotoSlide) => void; aoRemover: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [marcando, setMarcando] = useState(false)
  const automatico = marcaRosto && !!foto?.cab?.length
  return <div className="rounded-lg border p-2.5 space-y-2">
    {marcando && foto && src && <MarcarRosto aberto={marcando} aoFechar={() => setMarcando(false)} src={src} foto={foto}
      aoSalvar={(cab, w, h) => aoMudar({ ...foto, cab: cab.length ? cab : undefined, w: w || foto.w, h: h || foto.h })} />}
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium">{def.rotulo} <span className="text-muted-foreground font-normal">· {def.proporcao}{def.obrigatoria ? ' · obrigatória' : ''}</span></p>
      {foto && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={aoRemover} aria-label={`Remover ${def.rotulo}`}><X className="h-4 w-4" /></Button>}
    </div>
    <div className="flex gap-3 items-start">
      <button type="button" onClick={() => input.current?.click()} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center" aria-label={`Escolher ${def.rotulo}`}>
        {src ? <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${foto?.x ?? 50}% ${foto?.y ?? 30}%`, ...estiloZoom(foto) }} /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
        {subindo && <span className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) aoSubir(f); e.target.value = '' }} />
      {foto ? <div className="flex-1 space-y-2.5 min-w-0">
        {marcaRosto && <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={automatico ? 'outline' : 'default'} disabled={!src} onClick={() => setMarcando(true)}><ScanFace className="h-4 w-4 mr-1.5" />{automatico ? 'Remarcar rosto' : 'Marcar rosto'}</Button>
          <span className={`text-[11px] ${automatico ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {automatico ? `${foto.cab!.length} cabeça${foto.cab!.length > 1 ? 's' : ''} marcada${foto.cab!.length > 1 ? 's' : ''}: enquadramento automático` : 'Sem rosto marcado: foco manual'}
          </span>
        </div>}
        {!automatico && <>
        <div className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>Foco horizontal</span><span className="tabular-nums">{foto.x}%</span></div>
          <Slider value={[foto.x]} min={0} max={100} step={1} onValueChange={([x]) => aoMudar({ ...foto, x })} aria-label="Foco horizontal" /></div>
        <div className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>Foco vertical (rosto no terço de cima)</span><span className="tabular-nums">{foto.y}%</span></div>
          <Slider value={[foto.y]} min={0} max={100} step={1} onValueChange={([y]) => aoMudar({ ...foto, y })} aria-label="Foco vertical" /></div>
        <div className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>Zoom (quadro fechado)</span><span className="tabular-nums">{Math.round((foto.z ?? 1) * 100)}%</span></div>
          <Slider value={[Math.round((foto.z ?? 1) * 100)]} min={100} max={200} step={5} onValueChange={([z]) => aoMudar({ ...foto, z: z / 100 })} aria-label="Zoom" /></div>
        </>}
      </div> : <p className="text-xs text-muted-foreground self-center">Toque para escolher a foto. Gere ou recorte na proporção {def.proporcao}, com o rosto no terço de cima.</p>}
    </div>
  </div>
}

// ─────────── editor de uma lâmina ───────────
function LaminaEditor(props: {
  doc: CarrosselDoc; slide: SlideDoc; i: number; achados: Achado[]; resolver: (f?: FotoSlide) => string | undefined; subindo: Record<string, boolean>
  mudar: (fn: (s: SlideDoc) => SlideDoc) => void; mover: (d: -1 | 1) => void; duplicar: () => void; remover: () => void; subir: (chave: string, f: File) => void
}) {
  const { doc, slide, i, achados, resolver, subindo, mudar, mover, duplicar, remover, subir } = props
  const tpl = TEMPLATE_POR_ID[doc.template]
  const def = tpl.slideTypes.find(t => t.tipo === slide.tipo)
  const total = doc.slides.length
  const bloqueios = achados.filter(a => a.nivel === 'bloqueia').length
  const trocarTipo = (tipo: string) => mudar(s => {
    const base = novoSlide(doc.template, tipo)
    const campos = { ...base.campos }
    for (const k of Object.keys(campos)) if (s.campos[k]) campos[k] = s.campos[k]
    return { ...s, tipo, campos }
  })
  return <section id={`lamina-${i}`} className="rounded-xl border bg-card p-3 sm:p-4 space-y-3 scroll-mt-20 min-w-0">
    <header className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">Lâmina {i + 1}</span>
      {bloqueios > 0 && <span className="text-[11px] rounded-full bg-destructive/15 text-destructive px-2 py-0.5">{bloqueios} bloqueio{bloqueios > 1 ? 's' : ''}</span>}
      <div className="w-full sm:w-56 sm:ml-2 order-last sm:order-none">
        <Select value={slide.tipo} onValueChange={trocarTipo}>
          <SelectTrigger className="h-9 w-full" aria-label="Tipo de lâmina"><SelectValue /></SelectTrigger>
          <SelectContent>{tpl.slideTypes.map(t => <SelectItem key={t.tipo} value={t.tipo}>{t.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="ml-auto flex gap-1">
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => mover(-1)} disabled={i === 0} aria-label="Subir lâmina"><ArrowUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => mover(1)} disabled={i === total - 1} aria-label="Descer lâmina"><ArrowDown className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={duplicar} aria-label="Duplicar lâmina"><CopyPlus className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={remover} aria-label="Remover lâmina"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </header>
    {!def ? <p className="text-sm text-destructive">Tipo "{slide.tipo}" não existe no {tpl.codigo}. Escolha um tipo válido acima.</p> :
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3 min-w-0">
          {def.campos.map(c => <CampoEditor key={c.chave} campo={c} valor={slide.campos[c.chave] ?? ''} aoMudar={v => mudar(s => ({ ...s, campos: { ...s.campos, [c.chave]: v } }))} />)}
          {def.usaFoto && <div className="space-y-2">
            {slide.foto && <p className="text-[11px] rounded-md bg-primary/10 text-foreground px-2.5 py-1.5"><b className="font-medium">Foto pedida:</b> {slide.foto}</p>}
            {def.fotos.map(f => <FotoEditor key={f.chave} def={f} foto={slide.fotos[f.chave]} src={resolver(slide.fotos[f.chave])} subindo={!!subindo[`${slide.id}:${f.chave}`]} marcaRosto={doc.template === 't10'}
              aoSubir={file => subir(f.chave, file)}
              aoMudar={nova => mudar(s => ({ ...s, fotos: { ...s.fotos, [f.chave]: nova } }))}
              aoRemover={() => mudar(s => { const fotos = { ...s.fotos }; delete fotos[f.chave]; return { ...s, fotos } })} />)}
          </div>}
          {achados.length > 0 && <ul className="space-y-1">
            {achados.map((a, k) => <li key={k} className={`text-[11px] flex gap-1.5 ${a.nivel === 'bloqueia' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
              {a.nivel === 'bloqueia' ? <XCircle className="h-3.5 w-3.5 shrink-0 mt-px" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />}
              <span>{a.onde.replace(`Lâmina ${i + 1} · `, '').replace(`Lâmina ${i + 1}`, '')}{a.onde.includes('·') ? ': ' : ''}{a.regra}{a.trecho ? ` · "${a.trecho}"` : ''}</span>
            </li>)}
          </ul>}
        </div>
        <PreviewAjustado max={220} className="md:sticky md:top-20 self-start w-full max-w-[220px] mx-auto" template={doc.template} slide={slide} n={i + 1} total={total} opcoes={doc.opcoes} />
      </div>}
  </section>
}

// ─────────── aba ───────────
export function AbaMontar({ doc, setDoc, substituirDoc }: Props) {
  const tpl = TEMPLATE_POR_ID[doc.template]
  const qc = useQueryClient()
  const [json, setJson] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [avisosJson, setAvisosJson] = useState<string[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [subindo, setSubindo] = useState<Record<string, boolean>>({})
  const [salvando, setSalvando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [forcar, setForcar] = useState(false)
  const [zoom, setZoom] = useState('0.5')
  const palco = useRef<(HTMLDivElement | null)[]>([])

  const rascunhos = useQuery({ queryKey: ['criador-rascunhos'], queryFn: listarRascunhos, retry: 1 })

  // URLs assinadas das fotos que estão no bucket
  const paths = useMemo(() => doc.slides.flatMap(s => Object.values(s.fotos).map(f => f.path).filter((p): p is string => !!p)), [doc.slides])
  useEffect(() => {
    const faltam = paths.filter(p => !urls[p])
    if (!faltam.length) return
    urlsAssinadas(faltam).then(novas => setUrls(u => ({ ...u, ...novas }))).catch(() => toast.error('Não consegui abrir as fotos do rascunho.'))
  }, [paths, urls])

  const resolver = useCallback((f?: FotoSlide) => f?.url ?? (f?.path ? urls[f.path] : undefined), [urls])
  // T10: medições de layout feitas pela própria lâmina renderizada (porte do conferir_t10.py)
  const [medicoes, setMedicoes] = useState<Record<string, RelatorioT10>>({})
  const relatar = useCallback((id: string, r: RelatorioT10) => setMedicoes(m => (JSON.stringify(m[id]) === JSON.stringify(r) ? m : { ...m, [id]: r })), [])
  const achados = useMemo(() => {
    const base = revisar(doc)
    if (doc.template !== 't10') return base
    doc.slides.forEach((s, i) => {
      const m = medicoes[s.id]
      if (!m) return
      for (const e of m.erros) base.push({ nivel: 'bloqueia', regra: e, onde: `Lâmina ${i + 1}`, lamina: i })
      for (const a of m.avisos) base.push({ nivel: 'aviso', regra: a, onde: `Lâmina ${i + 1}`, lamina: i })
    })
    return base
  }, [doc, medicoes])
  const bloqueios = achados.filter(a => a.nivel === 'bloqueia')
  const avisos = achados.filter(a => a.nivel === 'aviso')
  const bloqueado = temBloqueio(achados)

  const mudarSlide = (i: number) => (fn: (s: SlideDoc) => SlideDoc) => setDoc(d => ({ ...d, slides: d.slides.map((s, k) => (k === i ? fn(s) : s)) }))

  const montarDoJson = () => {
    const r = lerJsonDoAgente(json, doc.template)
    if ('erros' in r) { setErros(r.erros); setAvisosJson([]); return }
    setErros([])
    setAvisosJson(r.avisos)
    // Fotos já escolhidas ficam na mesma posição quando o tipo da lâmina bate (colar a revisão não apaga as fotos).
    const slides = r.doc.slides.map((s, i) => {
      const antigo = doc.slides[i]
      return antigo && antigo.tipo === s.tipo && r.doc.template === doc.template ? { ...s, fotos: antigo.fotos } : s
    })
    substituirDoc({ ...doc, template: r.doc.template, titulo: r.doc.titulo || doc.titulo, legenda: r.doc.legenda || doc.legenda, slides,
      opcoes: r.doc.template === doc.template ? doc.opcoes : opcoesPadrao(r.doc.template) })
    toast.success(`${slides.length} lâminas montadas no ${TEMPLATE_POR_ID[r.doc.template].codigo}.`)
  }

  const trocarTemplate = (id: TemplateId) => {
    if (id === doc.template) return
    const temConteudo = doc.slides.some(s => Object.values(s.campos).some(v => v.trim()))
    if (temConteudo && !window.confirm('Trocar o template começa um carrossel novo com a estrutura dele. O conteúdo atual some da tela (o que foi salvo continua nos rascunhos). Continuar?')) return
    substituirDoc({ ...novoDoc(id), titulo: doc.titulo, legenda: doc.legenda })
  }

  const subir = (i: number) => async (chave: string, file: File) => {
    const slide = doc.slides[i]
    const k = `${slide.id}:${chave}`
    setSubindo(s => ({ ...s, [k]: true }))
    const [x, y] = focoPadrao(doc.template, slide.tipo, chave)
    try {
      const path = await subirFoto(file, doc.id || 'rascunho')
      const assinadas = await urlsAssinadas([path])
      setUrls(u => ({ ...u, ...assinadas }))
      mudarSlide(i)(s => ({ ...s, fotos: { ...s.fotos, [chave]: { path, x: s.fotos[chave]?.x ?? x, y: s.fotos[chave]?.y ?? y, z: s.fotos[chave]?.z ?? 1 } } }))
    } catch (e) {
      // sem bucket (ou sem rede): a foto fica só nesta tela, para montar e exportar agora
      const url = URL.createObjectURL(file)
      mudarSlide(i)(s => ({ ...s, fotos: { ...s.fotos, [chave]: { url, x: s.fotos[chave]?.x ?? x, y: s.fotos[chave]?.y ?? y } } }))
      toast.warning(`A foto não subiu para o armazenamento (${e instanceof Error ? e.message : 'erro'}). Ela vale nesta tela, mas não fica salva no rascunho.`)
    } finally {
      setSubindo(s => { const n = { ...s }; delete n[k]; return n })
    }
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const id = await salvarRascunho(doc)
      setDoc(d => ({ ...d, id }))
      qc.invalidateQueries({ queryKey: ['criador-rascunhos'] })
      toast.success('Rascunho salvo.')
    } catch (e) {
      toast.error(`Não salvou: ${e instanceof Error ? e.message : 'erro'}`)
    } finally { setSalvando(false) }
  }

  const carregar = async (id: string) => {
    try {
      const d = await carregarRascunho(id)
      substituirDoc(d)
      toast.success('Rascunho aberto.')
    } catch (e) { toast.error(`Não abriu: ${e instanceof Error ? e.message : 'erro'}`) }
  }

  const excluir = async () => {
    if (!doc.id || !window.confirm('Excluir este rascunho? As fotos continuam no armazenamento.')) return
    try {
      await excluirRascunho(doc.id)
      qc.invalidateQueries({ queryKey: ['criador-rascunhos'] })
      substituirDoc(novoDoc(doc.template))
      toast.success('Rascunho excluído.')
    } catch (e) { toast.error(`Não excluiu: ${e instanceof Error ? e.message : 'erro'}`) }
  }

  // Exportação: o palco com as lâminas em 1080x1350 sem escala só existe durante a exportação.
  useEffect(() => {
    if (!exportando) return
    let cancelado = false
    ;(async () => {
      try {
        await esperarFontes()
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        const nos = palco.current.slice(0, doc.slides.length).filter((n): n is HTMLDivElement => !!n)
        await Promise.all(nos.flatMap(n => Array.from(n.querySelectorAll('img')).map(img => (img.complete ? Promise.resolve() : new Promise(ok => { img.onload = img.onerror = () => ok(null) })))))
        await new Promise(r => setTimeout(r, 250))
        if (cancelado) return
        await exportarZip(nos, doc.legenda, doc.titulo, (f, t) => setProgresso(`${f}/${t}`))
        toast.success(`ZIP com ${nos.length} PNG em 1080x1350 e a legenda.`)
      } catch (e) {
        toast.error(`A exportação falhou: ${e instanceof Error ? e.message : 'erro'}`)
      } finally {
        if (!cancelado) { setExportando(false); setProgresso('') }
      }
    })()
    return () => { cancelado = true }
  }, [exportando]) // eslint-disable-line react-hooks/exhaustive-deps

  const podeExportar = doc.slides.length > 0 && (!bloqueado || forcar)
  const irPara = (i?: number) => { if (i !== undefined) document.getElementById(`lamina-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return <FotoContext.Provider value={resolver}><RelatorioT10Context.Provider value={relatar}>
    <div className="space-y-4">
      {/* barra do carrossel */}
      <section className="rounded-xl border bg-card p-3 sm:p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={doc.template} onValueChange={v => trocarTemplate(v as TemplateId)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.codigo} · {t.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cz-titulo">Título interno</Label>
          <Input id="cz-titulo" value={doc.titulo} onChange={e => setDoc(d => ({ ...d, titulo: e.target.value }))} placeholder="Ex.: Paciente que nunca ligou" />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label>Rascunhos salvos</Label>
          <Select value={doc.id ?? ''} onValueChange={carregar}>
            <SelectTrigger className="w-full"><SelectValue placeholder={rascunhos.isError ? 'Rascunhos indisponíveis' : rascunhos.isLoading ? 'Carregando…' : `${rascunhos.data?.length ?? 0} rascunhos`} /></SelectTrigger>
            <SelectContent>{(rascunhos.data ?? []).map(r => <SelectItem key={r.id} value={r.id}>{(r.titulo || 'Sem título')} · {TEMPLATE_POR_ID[r.template as TemplateId]?.codigo ?? r.template} · {new Date(r.atualizado_em).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}{doc.id ? 'Salvar' : 'Salvar rascunho'}</Button>
          <Button variant="outline" onClick={() => { if (window.confirm('Começar um carrossel novo? O que não foi salvo sai da tela.')) substituirDoc(novoDoc(doc.template)) }}><FilePlus2 className="h-4 w-4 mr-1.5" />Novo</Button>
          <Button variant="outline" onClick={async () => { if (await copiarTexto(paraJsonDoAgente(doc))) toast.success('JSON copiado. Cole no Revisor ou no Diretor de foto.') }}><Copy className="h-4 w-4 mr-1.5" />Copiar JSON</Button>
          {doc.id && <Button variant="ghost" className="text-destructive" onClick={excluir}><Trash2 className="h-4 w-4 mr-1.5" />Excluir</Button>}
        </div>
      </section>

      {/* colar JSON */}
      <section className="rounded-xl border bg-card p-3 sm:p-4 space-y-2">
        <Label htmlFor="cz-json" className="flex items-center gap-2"><ClipboardPaste className="h-4 w-4" />Colar o JSON do agente (Roteirista ou Revisor)</Label>
        <Textarea id="cz-json" rows={5} value={json} onChange={e => setJson(e.target.value)} className="font-mono text-xs" placeholder='{"template":"t10","titulo":"...","legenda":"...","slides":[{"tipo":"capa","campos":{"titulo":"..."},"foto":"..."}]}' />
        <div className="flex flex-wrap gap-2">
          <Button onClick={montarDoJson} disabled={!json.trim()}>Montar lâminas</Button>
          {json && <Button variant="ghost" onClick={() => { setJson(''); setErros([]); setAvisosJson([]) }}>Limpar</Button>}
        </div>
        {erros.length > 0 && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-1">
          <p className="font-medium text-destructive">O JSON não entrou. Confira:</p>
          <ul className="list-disc pl-5 space-y-0.5">{erros.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>}
        {avisosJson.length > 0 && <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc pl-5">{avisosJson.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* lâminas */}
        <div className="space-y-3 min-w-0">
          <section className="rounded-xl border bg-card p-3 sm:p-4 flex flex-wrap gap-x-6 gap-y-3 items-center">
            <label className="flex items-center gap-2 text-sm"><Switch checked={doc.opcoes.assinatura} onCheckedChange={v => setDoc(d => ({ ...d, opcoes: { ...d.opcoes, assinatura: v } }))} />Assinatura "Método AORTA"</label>
            {(doc.template === 't5' || doc.template === 't6') && <div className="flex items-center gap-2 text-sm">
              <span>Fundo</span>
              <Select value={doc.opcoes.fundo ?? tpl.fundoPadrao} onValueChange={v => setDoc(d => ({ ...d, opcoes: { ...d.opcoes, fundo: v as 'preto' | 'branco' } }))}>
                <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="preto">Preto</SelectItem><SelectItem value="branco">Branco</SelectItem></SelectContent>
              </Select>
            </div>}
            {doc.template === 't10' && <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
              <span className="shrink-0">Rodapé da última</span>
              <Input className="h-9 w-full sm:w-44" value={doc.opcoes.dataRodape ?? ''} onChange={e => setDoc(d => ({ ...d, opcoes: { ...d.opcoes, dataRodape: e.target.value } }))} />
            </div>}
          </section>

          {doc.slides.map((s, i) => <LaminaEditor key={s.id} doc={doc} slide={s} i={i} achados={achados.filter(a => a.lamina === i)} resolver={resolver} subindo={subindo}
            mudar={mudarSlide(i)}
            mover={d => setDoc(x => { const sl = [...x.slides]; const j = i + d; if (j < 0 || j >= sl.length) return x; [sl[i], sl[j]] = [sl[j], sl[i]]; return { ...x, slides: sl } })}
            duplicar={() => setDoc(x => { const sl = [...x.slides]; sl.splice(i + 1, 0, { ...s, id: novoId(), campos: { ...s.campos }, fotos: { ...s.fotos } }); return { ...x, slides: sl } })}
            remover={() => setDoc(x => ({ ...x, slides: x.slides.filter((_, k) => k !== i) }))}
            subir={subir(i)} />)}

          <section className="rounded-xl border border-dashed p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Adicionar lâmina:</span>
            {tpl.slideTypes.map(t => <Button key={t.tipo} size="sm" variant="outline" onClick={() => setDoc(d => ({ ...d, slides: [...d.slides, novoSlide(d.template, t.tipo)] }))}>{t.nome}</Button>)}
          </section>
        </div>

        {/* revisor, exportação e legenda */}
        <aside className="space-y-3 lg:sticky lg:top-20 self-start min-w-0">
          <section className="rounded-xl border bg-card p-3 sm:p-4 space-y-3" aria-label="Revisor automático">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Revisor automático</h3>
              <span className="text-[11px] text-muted-foreground">sem IA, regras da casa</span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${bloqueios.length ? 'bg-destructive/15 text-destructive' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>{bloqueios.length} bloqueio{bloqueios.length === 1 ? '' : 's'}</span>
              <span className="rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400">{avisos.length} aviso{avisos.length === 1 ? '' : 's'}</span>
            </div>
            {achados.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />Nada a corrigir.</p> :
              <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {[...bloqueios, ...avisos].map((a, k) => <li key={k}>
                  <button type="button" onClick={() => irPara(a.lamina)} className="w-full text-left text-xs flex gap-1.5 rounded-md p-1.5 hover:bg-accent">
                    {a.nivel === 'bloqueia' ? <XCircle className="h-3.5 w-3.5 shrink-0 mt-px text-destructive" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px text-amber-500" />}
                    <span><b className="font-medium">{a.onde}:</b> {a.regra}{a.trecho ? <span className="text-muted-foreground"> · "{a.trecho}"</span> : null}</span>
                  </button>
                </li>)}
              </ul>}
            <div className="space-y-2 border-t pt-3">
              {bloqueado && <label className="flex items-center gap-2 text-xs"><Checkbox checked={forcar} onCheckedChange={v => setForcar(v === true)} />Exportar mesmo assim</label>}
              <Button className="w-full" onClick={() => setExportando(true)} disabled={!podeExportar || exportando}>
                {exportando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                {exportando ? `Exportando ${progresso}` : `Exportar ZIP (${doc.slides.length} PNG 1080x1350)`}
              </Button>
              {bloqueado && !forcar && <p className="text-[11px] text-muted-foreground">A exportação fica travada enquanto houver bloqueio.</p>}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cz-legenda">Legenda</Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">{doc.legenda.length} caracteres</span>
            </div>
            <Textarea id="cz-legenda" rows={8} value={doc.legenda} onChange={e => setDoc(d => ({ ...d, legenda: e.target.value }))} placeholder="Cole a legenda do Legendista ou escreva aqui." />
            <Button variant="outline" className="w-full" disabled={!doc.legenda.trim()} onClick={async () => { if (await copiarTexto(doc.legenda)) toast.success('Legenda copiada.') }}><Copy className="h-4 w-4 mr-1.5" />Copiar legenda</Button>
          </section>
        </aside>
      </div>

      {/* prévia de todas as lâminas */}
      <section className="rounded-xl border bg-card p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Prévia de todas as lâminas</h3>
          <Select value={zoom} onValueChange={setZoom}>
            <SelectTrigger className="h-9 w-36" aria-label="Tamanho da prévia"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="0.25">25%</SelectItem><SelectItem value="0.5">50%</SelectItem><SelectItem value="0.75">75%</SelectItem><SelectItem value="1">100% (real)</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {doc.slides.map((s, i) => <div key={s.id} className="shrink-0 space-y-1">
            <p className="text-[11px] text-muted-foreground">s{String(i + 1).padStart(2, '0')}.png</p>
            <SlidePreview largura={1080 * Number(zoom)} template={doc.template} slide={s} n={i + 1} total={doc.slides.length} opcoes={doc.opcoes} className="rounded-md ring-1 ring-border" />
          </div>)}
        </div>
      </section>

      {/* palco da exportação: 1080x1350 sem escala, fora da tela */}
      {exportando && <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: 1080, pointerEvents: 'none' }}>
        {doc.slides.map((s, i) => <SlideCanvas key={s.id} ref={el => { palco.current[i] = el }} template={doc.template} slide={s} n={i + 1} total={doc.slides.length} opcoes={doc.opcoes} />)}
      </div>}
    </div>
  </RelatorioT10Context.Provider></FotoContext.Provider>
}
