import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AbaTemplates } from '@/components/criador/AbaTemplates'
import { AbaAgentes } from '@/components/criador/AbaAgentes'
import { AbaConhecimento } from '@/components/criador/AbaConhecimento'
import { AbaMontar } from '@/components/criador/AbaMontar'
import { injetarFontes } from '@/lib/criador/fontes'
import { docDoExemplo, novoDoc } from '@/lib/criador/doc'
import { TEMPLATE_POR_ID } from '@/data/criador/templates'
import type { CarrosselDoc, Formato, TemplateId } from '@/data/criador/tipos'

// Criador de Carrossel (27/09/2026). Só o João (admin) usa.
// Sem IA dentro da Central: os agentes são prompts prontos, a resposta volta em JSON na aba Montar,
// que monta as lâminas, roda o revisor automático e exporta os PNG.

const CHAVE_LOCAL = 'criador-carrossel:doc'
const CHAVE_ABA = 'criador-carrossel:aba'

function lerLocal(): CarrosselDoc | null {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL)
    if (!bruto) return null
    const d = JSON.parse(bruto) as CarrosselDoc
    if (!d || !TEMPLATE_POR_ID[d.template] || !Array.isArray(d.slides)) return null
    return d
  } catch { return null }
}

/** Foto em blob só vive nesta aba do navegador: não vai para o armazenamento local. */
function paraLocal(d: CarrosselDoc): CarrosselDoc {
  return { ...d, slides: d.slides.map(s => ({ ...s, fotos: Object.fromEntries(Object.entries(s.fotos).filter(([, f]) => !f.url?.startsWith('blob:'))) })) }
}

export default function CriadorCarrossel() {
  const [doc, setDocState] = useState<CarrosselDoc>(() => lerLocal() ?? docDoExemplo('t10'))
  const [aba, setAba] = useState(() => { try { return localStorage.getItem(CHAVE_ABA) || 'templates' } catch { return 'templates' } })

  useEffect(() => { injetarFontes() }, [])
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(paraLocal(doc))) } catch { /* sem armazenamento local */ } }, 400)
    return () => clearTimeout(t)
  }, [doc])
  useEffect(() => { try { localStorage.setItem(CHAVE_ABA, aba) } catch { /* idem */ } }, [aba])

  const setDoc = useCallback((fn: (d: CarrosselDoc) => CarrosselDoc) => setDocState(fn), [])
  const substituirDoc = useCallback((d: CarrosselDoc) => setDocState(d), [])

  const usarTemplate = (id: TemplateId, formato: Formato = 'carrossel') => {
    const temConteudo = doc.slides.some(s => Object.values(s.campos).some(v => v.trim()))
    if (doc.id || (temConteudo && !doc.titulo.startsWith('Exemplo'))) {
      if (!window.confirm('Abrir o exemplo deste template na aba Montar? O carrossel que está lá sai da tela (o que foi salvo continua nos rascunhos).')) return
    }
    setDocState(id === doc.template && !temConteudo ? novoDoc(id, formato) : docDoExemplo(id, formato))
    setAba('montar')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className="space-y-4 min-w-0">
    <header className="space-y-1">
      <h1 className="text-xl sm:text-2xl font-semibold">Criador de carrossel</h1>
      <p className="text-sm text-muted-foreground">Templates, agentes de prompt, a base de conhecimento e a montagem com revisor e exportação em PNG 1080x1350. Nenhuma chamada de IA sai daqui.</p>
    </header>
    <Tabs value={aba} onValueChange={setAba} className="space-y-4">
      <TabsList className="w-full sm:w-auto justify-start overflow-x-auto flex-nowrap sm:flex-wrap">
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="agentes">Agentes</TabsTrigger>
        <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
        <TabsTrigger value="montar">Montar</TabsTrigger>
      </TabsList>
      <TabsContent value="templates"><AbaTemplates aoUsar={usarTemplate} /></TabsContent>
      <TabsContent value="agentes"><AbaAgentes templateInicial={doc.template} formatoInicial={doc.opcoes.formato ?? 'carrossel'} /></TabsContent>
      <TabsContent value="conhecimento"><AbaConhecimento /></TabsContent>
      <TabsContent value="montar"><AbaMontar doc={doc} setDoc={setDoc} substituirDoc={substituirDoc} /></TabsContent>
    </Tabs>
  </div>
}
