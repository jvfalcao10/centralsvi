import {useCallback,useEffect,useState} from 'react'
import {supabase} from '@/integrations/supabase/client'
import {Button} from '@/components/ui/button'
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card'
import {Copy,ExternalLink,Video} from 'lucide-react'
import {toast} from 'sonner'

type Reuniao={
 id:string;nome:string;email:string;whatsapp:string;assunto:string
 inicio:string;quando:string;status:string;meet_url:string|null;cancelada_por:string|null
}
type Dados={link:string;proximas:Reuniao[];passadas:Reuniao[]}

async function chamar(init?:RequestInit) {
 const {data:{session}}=await supabase.auth.getSession()
 const r=await fetch('/api/agenda?equipe=1',{...init,
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,...init?.headers}})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw new Error(d?.error||`Falhou (${r.status})`)
 return d
}

const zap=(numero:string)=>`https://wa.me/${numero.replace(/\D+/g,'')}`

function Linha({r,aoCancelar}:{r:Reuniao;aoCancelar?:(id:string)=>void}) {
 const cancelada=r.status==='cancelada'
 return (
  <div className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
   <div className="min-w-0">
    <p className="font-medium">
     {r.nome}
     {cancelada&&<span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">cancelada{r.cancelada_por?` por ${r.cancelada_por}`:''}</span>}
    </p>
    <p className="text-sm text-muted-foreground">{r.quando}</p>
    {r.assunto&&<p className="mt-1 text-sm">{r.assunto}</p>}
    <p className="mt-1 text-xs text-muted-foreground break-all">{r.email}</p>
   </div>
   <div className="flex shrink-0 flex-wrap gap-2">
    <Button asChild variant="outline" size="sm" className="min-h-9">
     <a href={zap(r.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>
    </Button>
    {!cancelada&&r.meet_url&&<Button asChild variant="outline" size="sm" className="min-h-9">
     <a href={r.meet_url} target="_blank" rel="noreferrer"><Video className="mr-1 h-3 w-3"/>Chamada</a>
    </Button>}
    {!cancelada&&aoCancelar&&<Button variant="ghost" size="sm" className="min-h-9 text-muted-foreground"
      onClick={()=>aoCancelar(r.id)}>Desmarcar</Button>}
   </div>
  </div>
 )
}

export default function AgendaEquipe() {
 const [dados,setDados]=useState<Dados|null>(null)
 const [erro,setErro]=useState('')

 const carregar=useCallback(()=>{
  chamar().then(d=>{setDados(d);setErro('')}).catch(e=>setErro(e.message))
 },[])
 useEffect(carregar,[carregar])

 const desmarcar=async(id:string)=>{
  // Desmarcar apaga o evento do Google e avisa a pessoa: confirmar antes.
  if(!window.confirm('Desmarcar esta reunião? A pessoa recebe aviso no WhatsApp e o evento sai da sua agenda.'))return
  try{
   await chamar({method:'POST',body:JSON.stringify({acao:'cancelar_equipe',id})})
   toast.success('Reunião desmarcada.')
   carregar()
  }catch(e){toast.error((e as Error).message)}
 }

 return (
  <div className="space-y-6 p-4 sm:p-6">
   <div>
    <h1 className="text-2xl font-semibold">Agenda de reuniões</h1>
    <p className="text-sm text-muted-foreground">Diagnóstico de 30 minutos, marcado pela página pública e gravado na agenda do João.</p>
   </div>

   <Card>
    <CardHeader className="pb-3"><CardTitle className="text-base">Link para mandar ao prospect</CardTitle></CardHeader>
    <CardContent className="flex flex-wrap items-center gap-2">
     <code className="rounded bg-muted px-3 py-2 text-sm break-all">{dados?.link||'agenda.svicompany.com.br'}</code>
     <Button size="sm" variant="outline" className="min-h-9" onClick={()=>{
       void navigator.clipboard.writeText(dados?.link||'https://agenda.svicompany.com.br')
       toast.success('Link copiado.')
     }}><Copy className="mr-1 h-3 w-3"/>Copiar</Button>
     <Button asChild size="sm" variant="ghost" className="min-h-9">
      <a href={dados?.link||'https://agenda.svicompany.com.br'} target="_blank" rel="noreferrer">
       <ExternalLink className="mr-1 h-3 w-3"/>Ver a página</a>
     </Button>
    </CardContent>
   </Card>

   {erro&&<p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{erro}</p>}

   <Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">Próximas ({dados?.proximas.length??0})</CardTitle></CardHeader>
    <CardContent>
     {!dados&&!erro&&<p className="text-sm text-muted-foreground">Carregando.</p>}
     {dados&&!dados.proximas.length&&<p className="text-sm text-muted-foreground">Nenhuma reunião marcada.</p>}
     {dados?.proximas.map(r=><Linha key={r.id} r={r} aoCancelar={desmarcar}/>)}
    </CardContent>
   </Card>

   {!!dados?.passadas.length&&<Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">Já aconteceram ou foram canceladas</CardTitle></CardHeader>
    <CardContent>{dados.passadas.map(r=><Linha key={r.id} r={r}/>)}</CardContent>
   </Card>}
  </div>
 )
}
