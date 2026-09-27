import MobileSocialBoard from '@/components/social/MobileSocialBoard'
import {useSocialTouchLayout} from '@/hooks/use-social-touch-layout'
import ClientApprovalLink from '@/components/social/ClientApprovalLink'
import ApprovalLink from '@/components/social/ApprovalLink'
import FeedbackRouting, { type FeedbackContext } from '@/components/social/FeedbackRouting'
import VideoPreview from '@/components/social/VideoPreview'
import DesktopSocialBoard from '@/components/social/DesktopSocialBoard'
import {StageSelect} from '@/components/social/CardActions'
import PublicationDetails from '@/components/social/PublicationDetails'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, ArrowDown, Check, CheckCircle2, Clock3, Copy, Download, ExternalLink, ImageIcon, Link2, Loader2, RefreshCw, Search, X, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { socialApi, SOCIAL_STAGES, socialDate, type Card } from '@/lib/social-board'
import { useToast } from '@/hooks/use-toast'

type Event = {id:number; action:string; actor:string; revision:number; created_at:string; details:{from:string;to:string;evidence?:string;note?:string}}
const actionLabel:Record<string,string>={editar:'Atualizou a peça',solicitar:'Gerou link de aprovação',aprovar:'Registrou aprovação',cliente_aprovar:'Aprovou pelo link',ajustes:'Pediu ajustes',cliente_ajustes:'Pediu ajustes pelo link',cliente_reprovar:'Reprovou pelo link',destino:'Atualizou o destino do retorno',agendar:'Agendou a postagem',postar:'Confirmou a postagem',arquivar:'Arquivou',conferir:'Voltou para conferência',importar:'Recebeu novos arquivos',mover:'Mudou a etapa',informacoes:'Atualizou informações da postagem',receber:'Recebeu uma nova entrega',reenvio:'Reconheceu um reenvio idêntico'}
const cleanTitle=(s:string)=>s.replace(/^(HOJE|AMANHÃ|QUA|QUI|SEX|SEG|TER|SÁB|SAB|DOM)[^·]*·\s*/i,'')

export default function Social() {
 const [params,setParams]=useSearchParams(); const {toast}=useToast()
 const isMobile=useSocialTouchLayout();const [showFilters,setShowFilters]=useState(false)
 const [sync,setSync]=useState<{sources:{id:string;label:string;enabled:boolean;last_success_at:string|null;error:string|null}[];pending:number;issues:{key:string;title:string;source_url:string;reason:string}[]}|null>(null);
 const [feedback,setFeedback]=useState<FeedbackContext|null>(null);const [routeDirty,setRouteDirty]=useState(false);
 const [editClient,setEditClient]=useState('');const [editTitle,setEditTitle]=useState('');
 const [cards,setCards]=useState<Card[]>([]); const [loading,setLoading]=useState(true);const [error,setError]=useState('')
 const [query,setQuery]=useState('');const [client,setClient]=useState(params.get('cliente')||'');const [author,setAuthor]=useState('');const [stage,setStage]=useState('');const [archived,setArchived]=useState(false)
 const [card,setCard]=useState<Card|null>(null);const [events,setEvents]=useState<Event[]>([]);const [detailLoading,setDetailLoading]=useState(false);const [busy,setBusy]=useState(false)
 const [caption,setCaption]=useState('');const [note,setNote]=useState('');const [selected,setSelected]=useState<string[]>([])
 const [approvalUrl,setApprovalUrl]=useState('')
 const detailRequest=useRef(0);const moving=useRef(false)
 const notify=(message:string)=>toast({description:message})
 const load=useCallback(async()=>{try {setError('');const [data,status]=await Promise.all([socialApi(),socialApi('?sync=status')]);setCards(data.cards);setSync(status)}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[])
 const open=useCallback(async(id:string)=>{const request=++detailRequest.current;setDetailLoading(true);setCard(null);setFeedback(null);setRouteDirty(false);setApprovalUrl('');try{const d=await socialApi('?id='+encodeURIComponent(id));if(request!==detailRequest.current)return;setCard(d.card);setFeedback(d.feedback);setApprovalUrl(d.approval_url||'');setEditClient(d.card.client);setEditTitle(d.card.title);setEvents(d.events);setCaption(d.card.caption);setNote(d.card.note);setSelected(d.card.selected_assets);}catch(e){if(request===detailRequest.current)setError((e as Error).message)}finally{if(request===detailRequest.current)setDetailLoading(false)}},[])
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer)},[load])
 const cardId=params.get('peca')
 useEffect(()=>{if(cardId)void open(cardId);else setCard(null)},[cardId,open])

 const choose=(id:string)=>setParams(p=>{p.set('peca',id);return p})
 const close=()=>{if(busy)return;detailRequest.current++;setCard(null);setParams(p=>{p.delete('peca');return p})}
 const clients=useMemo(()=>[...new Set(cards.map(c=>c.client))].sort((a,b)=>a.localeCompare(b)),[cards])
 const authors=useMemo(()=>[...new Set(cards.map(c=>c.author))].sort(),[cards])
 const filtered=cards.filter(c=>(!client||c.client===client)&&(!author||c.author===author)&&(!query||`${c.title} ${c.client} ${c.note}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(archived||c.stage!=='arquivado'))
 const mobileStage=stage||'conferir'
 const columns=SOCIAL_STAGES.filter(s=>(archived||s.id!=='arquivado')&&(!stage||stage==='all'||s.id===stage))
 const contentDirty=card&&(editClient!==card.client||editTitle!==card.title||caption!==card.caption||note!==card.note||JSON.stringify(selected)!==JSON.stringify(card.selected_assets))
 const dirty=contentDirty||routeDirty
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);notify('Copiado.')}catch{notify('Não foi possível copiar. Selecione o texto e copie.')}}
 const save=async()=>{
  if(!card||busy)return;setBusy(true)
  try{
   await socialApi('',{id:card.id,version:card.version,action:'editar',client:editClient,title:editTitle,caption,note,selected_assets:selected})
   await load();await open(card.id);notify('Versão salva para toda a equipe.')
  }catch(e){notify((e as Error).message)}finally{setBusy(false)}
 }
 const generateApprovalLink=async()=>{
  if(!card)throw new Error('Reabra a peça para gerar o link.')
  setBusy(true)
  try{const result=await socialApi('',{id:card.id,version:card.version,action:'solicitar'});if(!result.approval_url)throw new Error('Não foi possível gerar o link. Tente novamente.');setApprovalUrl(result.approval_url);const d=await socialApi('?id='+encodeURIComponent(card.id));setCard(d.card);setEvents(d.events);setFeedback(d.feedback);void load();return result.approval_url as string}finally{setBusy(false)}
 }
 const moveStage=async(id:string,target:string)=>{
  if(moving.current||busy)return
  const current=card?.id===id?card:cards.find(c=>c.id===id)
  if(!current||current.stage===target)return
  if(cardId&&cardId!==id)return
  if(cardId&&dirty){notify('Salve suas alterações na peça antes de mudar a etapa.');return}
  moving.current=true;setBusy(true)
  try{await socialApi('',{id:current.id,version:current.version,action:'mover',stage:target});await load();if(cardId===id)await open(id);notify(`Peça movida para ${SOCIAL_STAGES.find(s=>s.id===target)?.label}.`)}catch(e){notify((e as Error).message)}finally{moving.current=false;setBusy(false)}
 }
 const reorder=(id:string,delta:number)=>setSelected(previous=>{const i=previous.indexOf(id),j=i+delta;if(i<0||j<0||j>=previous.length)return previous;const next=[...previous];[next[i],next[j]]=[next[j],next[i]];return next})
 return <main className="space-y-4 md:space-y-6 min-w-0">
  <header className="flex flex-wrap items-start justify-between gap-4">
   <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold tracking-[.22em] text-primary uppercase">Conteúdo · Central SVI</p><h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">O que vamos postar?</h1><p className="hidden md:block mt-2 text-sm text-muted-foreground max-w-2xl">A arte, o vídeo, a legenda e a aprovação no mesmo lugar. {isMobile?'Deslize para rolar e use a alça para mover a peça.':'Mude a etapa pelo card ou pelo botão direito.'} Abra a peça para editar os detalhes.</p></div>
   <div className="flex gap-2"><Button variant="outline" size="sm" aria-label="Atualizar quadro" onClick={()=>void load()}><RefreshCw className="w-4 h-4"/><span className="hidden sm:inline">Atualizar</span></Button></div>
  </header>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
   {[{id:'aprovado',label:'Prontos para postar',icon:CheckCircle2},{id:'aguardando',label:'Esperando resposta',icon:Clock3},{id:'ajustes',label:'Precisam de ajuste',icon:ImageIcon},{id:'agendado',label:'Na agenda',icon:Check}].map(item=><button key={item.id} onClick={()=>setStage(stage===item.id?'':item.id)} className={`text-left rounded-xl border p-3 sm:p-4 flex items-center justify-between gap-2 transition-colors ${(isMobile?mobileStage:stage)===item.id?'border-primary bg-primary/10':'bg-card hover:border-primary/50'}`}><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-xl sm:text-3xl font-semibold mt-1">{filtered.filter(c=>c.stage===item.id).length}</p></div><item.icon className="h-5 w-5 text-primary/80"/></button>)}
  </div>
  <section className="grid grid-cols-1 md:flex md:flex-wrap md:items-center gap-2" aria-label="Filtros do quadro">
   <div className="relative min-w-0 md:flex-1 md:min-w-[190px]"><Search className="absolute left-3 top-3.5 md:top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Buscar peça" placeholder="Buscar peça ou assunto" className="pl-9" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <select aria-label="Cliente" className="h-11 md:h-10 w-full md:w-auto min-w-0 max-w-full rounded-md border bg-background px-3 text-base md:text-sm" value={client} onChange={e=>{setClient(e.target.value);setParams(p=>{e.target.value?p.set('cliente',e.target.value):p.delete('cliente');return p})}}><option value="">Todos os clientes</option>{clients.map(c=><option key={c}>{c}</option>)}</select>
   <div className="flex min-w-0 gap-2">
    <select aria-label="Etapa" className="h-11 md:h-10 w-full md:w-auto min-w-0 rounded-md border bg-background px-3 text-base md:text-sm" value={isMobile?mobileStage:stage==='all'?'':stage} onChange={e=>{setStage(e.target.value);if(e.target.value==='arquivado')setArchived(true)}}><option value={isMobile?'all':''}>Todas as etapas</option>{SOCIAL_STAGES.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select>
    {isMobile&&<Button variant="outline" aria-expanded={showFilters} aria-controls="social-extra-filters" onClick={()=>setShowFilters(v=>!v)}>Filtros{(author||archived)?' •':''}</Button>}
   </div>
   {(!isMobile||showFilters)&&<div id="social-extra-filters" className="grid grid-cols-1 md:flex md:items-center gap-2">
    <select aria-label="Responsável" className="h-11 md:h-10 min-w-0 rounded-md border bg-background px-3 text-base md:text-sm" value={author} onChange={e=>setAuthor(e.target.value)}><option value="">Todos os responsáveis</option>{authors.map(a=><option key={a}>{a}</option>)}</select>
    <label className="flex min-h-11 items-center gap-3 px-2 text-sm text-muted-foreground"><input type="checkbox" className="h-5 w-5 md:h-4 md:w-4" checked={archived} onChange={e=>{setArchived(e.target.checked);if(!e.target.checked&&stage==='arquivado')setStage('')}}/>Mostrar arquivo</label>
   </div>}
  </section>
  {(!isMobile||client)&&<details key={client} className="rounded-xl border bg-card px-4 py-3"><summary className="cursor-pointer text-sm font-medium py-1">Link de aprovação do cliente{client?` · ${client}`:''}</summary><ClientApprovalLink client={client} pendingCount={cards.filter(c=>c.client===client&&c.stage==='aguardando').length}/></details>}
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{filtered.length} peças · {filtered.reduce((n,c)=>n+c.assets.length,0)} arquivos · acervo da equipe</span><span className="hidden md:inline">Mudanças de etapa ficam no histórico.</span></div>
  {sync&&<details className="rounded-lg border bg-card p-3 text-xs"><summary className="min-h-8 cursor-pointer flex flex-wrap items-center gap-2"><RefreshCw className="w-3 h-3"/>Entrada automática · ClickUp, grupos e Sofia{sync.pending>0&&<span className="text-muted-foreground">{sync.pending} na fila</span>}{(sync.issues.length>0||sync.sources.some(s=>s.error||!s.last_success_at||Date.now()-Date.parse(s.last_success_at)>15*60000))&&<span className="text-orange-400">Conferir sincronização</span>}</summary><div className="mt-3 space-y-3"><p className="text-muted-foreground">Novos uploads de José, Laís e Math no ClickUp. Consulta a cada 2 minutos; o quadro se atualiza a cada minuto. Nos respectivos grupos, Math e Sarah podem identificar o vídeo com CLIENTE | TÍTULO | V1. Uma correção usa o mesmo título e V2. Envie como documento para preservar o arquivo. Entrega nova exige conferência. No privado da Sofia, vídeo enviado como arquivo/documento vai para a Central; vídeo enviado normalmente vai para transcrição. Ela pergunta se faltar identificar o cliente. Pastas: ano / mês / cliente. Para indicar outro mês, use POSTAR | CLIENTE | OUTUBRO na legenda do documento. APROVADO registra a liberação quando informado por João ou Letícia.</p><div className="flex flex-wrap gap-3">{sync.sources.map(s=><p key={s.id}>{s.label}: <span className={s.error?'text-orange-400':'text-muted-foreground'}>{s.error?'consulta pendente':s.last_success_at?socialDate(s.last_success_at):'primeira consulta pendente'}</span></p>)}</div>{sync.issues.map(i=><div key={i.key} className="border-l-2 border-orange-400 pl-3"><p className="font-medium">{i.title}</p><p className="text-muted-foreground">{i.reason}</p><a className="underline text-primary" href={i.source_url} target="_blank" rel="noreferrer">Conferir na origem</a></div>)}</div></details>}
  {error&&<div role="alert" className="p-4 rounded-lg border border-destructive/40 text-destructive">{error}<Button variant="ghost" size="sm" onClick={()=>void load()}>Tentar novamente</Button></div>}
  {loading?<div className="flex gap-2 items-center py-16 text-muted-foreground"><Loader2 className="animate-spin h-5 w-5"/>Carregando o quadro…</div>:isMobile?<MobileSocialBoard cards={filtered} stage={mobileStage} filterKey={`${client}|${author}|${query}|${archived}`} busy={busy||!!cardId} onOpen={choose} onMove={(id,target)=>void moveStage(id,target)} onCopy={text=>void copy(text)}/>:<DesktopSocialBoard cards={filtered} columns={columns} busy={busy||!!cardId} onOpen={choose} onMove={(id,target)=>void moveStage(id,target)} onCopy={text=>void copy(text)}/>}
  <Sheet open={!!cardId} onOpenChange={value=>{if(!value)close()}}><SheetContent className="[&>button]:hidden w-full h-dvh sm:max-w-5xl overflow-y-auto overscroll-contain p-4 sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] break-words">
   <div className="sticky -top-4 sm:-top-8 z-20 -mx-4 sm:-mx-8 -mt-4 sm:-mt-8 mb-4 flex justify-end border-b bg-background/95 backdrop-blur px-2 py-1"><Button size="sm" variant="ghost" onClick={close} disabled={busy} aria-label="Fechar peça"><X className="h-4 w-4"/>Fechar</Button></div>
   {!card?<SheetHeader><SheetTitle>{detailLoading?'Carregando peça…':'Peça indisponível'}</SheetTitle><SheetDescription>Arquivos e histórico da publicação.</SheetDescription></SheetHeader>:<>
    <SheetHeader><p className="text-xs text-primary uppercase tracking-widest">{card.client} · versão {card.revision}</p><SheetTitle className="text-xl pr-5">{cleanTitle(card.title)}</SheetTitle><SheetDescription>{SOCIAL_STAGES.find(s=>s.id===card.stage)?.label} · {card.author}</SheetDescription></SheetHeader>
    <details className="mt-4 rounded-xl border p-3"><summary className="cursor-pointer py-1 text-sm font-medium">Link com todas as pendências do cliente</summary><ClientApprovalLink key={'client:'+card.client} client={card.client} pendingCount={cards.filter(c=>c.client===card.client&&c.stage==='aguardando').length} disabledReason={dirty?'Salve as alterações antes de compartilhar.':undefined}/></details>
    <details id="social-individual-link" className="mt-4 rounded-xl border p-3" ><summary className="cursor-pointer py-1 text-sm font-medium">Link de aprovação desta peça</summary>
    <ApprovalLink key={card.id} url={approvalUrl} legacy={card.stage==='aguardando'&&!approvalUrl} routingPending={!feedback?.route.task_id||!feedback?.route.group_id} disabledReason={busy?'Aguarde a operação atual.':dirty?'Salve as alterações da peça antes de gerar ou copiar o link.':card.ingest_pending?'Aguarde a importação dos arquivos.':card.client==='Identificar cliente'?'Identifique o cliente desta peça.':!selected.length?'Selecione os arquivos finais abaixo e salve a versão.':['postado','arquivado'].includes(card.stage)?'Esta peça está encerrada.':undefined} onGenerate={generateApprovalLink}/>
    </details>
    {card.ingest_pending&&<p className="mt-4 rounded border border-orange-400/40 p-3 text-xs text-orange-400">Uma entrega nova está sendo importada. A aprovação fica bloqueada até os arquivos estarem disponíveis. Consulte a sincronização no quadro se houver demora.</p>}
    <div className="mt-6 grid lg:grid-cols-[1.05fr_1fr] gap-7">
     <div className="min-w-0 space-y-5">
      <div><h3 className="font-semibold text-sm">Arquivos da peça</h3><p className="text-xs text-muted-foreground mt-1">Selecione os arquivos finais. As setas definem a ordem do carrossel.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{card.assets.map(a=>{const pos=selected.indexOf(a.id);return <div key={a.id} className={`border rounded-lg overflow-hidden ${pos>=0?'border-primary/70':'opacity-65'}`}>
       {a.type.startsWith('video/')?<VideoPreview key={a.id} asset={a}/>:a.type.startsWith('image/')&&a.preview?<a href={a.url} target="_blank" rel="noreferrer"><img className="w-full h-44 object-contain bg-black/10" src={a.preview} alt={a.name}/></a>:<a href={a.url} target="_blank" rel="noreferrer" className="h-32 flex items-center justify-center text-sm">Abrir arquivo</a>}
       <div className="p-3 space-y-2"><p className="text-sm sm:text-xs break-words line-clamp-2" title={a.name}>{a.name}</p><label className="flex min-h-11 items-center gap-3 text-sm"><input className="h-5 w-5" disabled={busy||card.stage==='postado'} type="checkbox" checked={pos>=0} onChange={e=>setSelected(p=>e.target.checked?[...p,a.id]:p.filter(id=>id!==a.id))}/>{pos>=0?`${pos+1} · Arquivo final`:'Incluir na versão'}</label>
        <div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" disabled={pos<=0||busy||card.stage==='postado'} aria-label={`Subir ${a.name}`} onClick={()=>reorder(a.id,-1)}><ArrowUp className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="h-7 w-7" disabled={pos<0||pos===selected.length-1||busy||card.stage==='postado'} aria-label={`Descer ${a.name}`} onClick={()=>reorder(a.id,1)}><ArrowDown className="h-3 w-3"/></Button><a href={a.url} target="_blank" rel="noreferrer" className="ml-auto min-h-11 px-2 text-sm text-primary flex items-center gap-2"><Download className="h-3 w-3"/>Original</a></div>
       </div>
      </div>})}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href={card.source_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-2"/>{card.source_url.includes('clickup.com')?'Tarefa no ClickUp':'Abrir WhatsApp'}</a></Button></div>
      <details className="text-xs rounded-lg border p-3"><summary className="cursor-pointer font-medium">Briefing e origem</summary><Button variant="ghost" size="sm" className="mt-3" onClick={()=>void copy(`${window.location.origin}/content/social?peca=${card.id}`)}><Link2 className="h-3 w-3 mr-2"/>Copiar link interno da equipe</Button><p className="text-muted-foreground">Este endereço exige acesso à Central. Para o cliente, use o link de aprovação.</p><p className="text-muted-foreground mt-3">Status coletado: {card.source_status} · arquivo de {socialDate(card.source_updated)}. Esse status não comprova aprovação nem postagem.</p><p className="whitespace-pre-wrap mt-3 text-muted-foreground max-h-72 overflow-y-auto">{card.source_description||'Consulte a tarefa de origem.'}</p></details>
     </div>
     <div className="min-w-0 space-y-5">
      <div className="space-y-3"><div><label htmlFor="social-client" className="text-sm font-semibold">Cliente</label><Input id="social-client" list="social-clients" value={editClient} onChange={e=>setEditClient(e.target.value)} disabled={busy||card.stage==='postado'} className="mt-1"/><datalist id="social-clients">{clients.filter(c=>c!=='Identificar cliente').map(c=><option key={c} value={c}/>)}</datalist></div><div><label htmlFor="social-title" className="text-sm font-semibold">Título da peça</label><Input id="social-title" value={editTitle} onChange={e=>setEditTitle(e.target.value)} disabled={busy||card.stage==='postado'} className="mt-1"/></div></div>
      <div><label htmlFor="social-caption" className="text-sm font-semibold">Legenda final</label><Textarea id="social-caption" disabled={busy||card.stage==='postado'} value={caption} onChange={e=>setCaption(e.target.value)} className="min-h-40 mt-2" placeholder="Cole aqui a legenda que acompanha esta versão."/><Button disabled={!caption} size="sm" variant="ghost" onClick={()=>void copy(caption)}><Copy className="h-3 w-3 mr-2"/>Copiar legenda</Button></div>
      <div><label htmlFor="social-note" className="text-sm font-semibold">Observação da equipe</label><Textarea id="social-note" disabled={busy||card.stage==='postado'} value={note} onChange={e=>setNote(e.target.value)} className="min-h-20 mt-2"/><p className="text-[11px] text-muted-foreground mt-1">Visível somente para a equipe.</p></div>
      {contentDirty&&<div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2"><p className="text-xs">Alterar os arquivos ou a legenda exige nova aprovação. O histórico anterior fica registrado.</p><Button disabled={busy||routeDirty} size="sm" onClick={()=>void save()}>Salvar versão</Button></div>}
      {feedback&&<details className="rounded-xl border p-3"><summary className="cursor-pointer py-1 text-sm font-medium">Responsável e destino do retorno</summary><FeedbackRouting key={`${card.id}:${card.version}`} cardId={card.id} version={card.version} context={feedback} onDirty={setRouteDirty} onSaved={async()=>{await load();const d=await socialApi('?id='+encodeURIComponent(card.id));setCard(d.card);setFeedback(d.feedback);setEvents(d.events);setRouteDirty(false)}}/></details>}
      {card.approved_by&&<div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-4"><p className="text-sm font-medium">Aprovado por {card.approved_by}</p><p className="text-xs text-muted-foreground mt-1">Registrado em {socialDate(card.approved_at)} · versão {card.revision}</p><p className="text-xs mt-2 whitespace-pre-wrap">{card.approval_evidence}</p></div>}
      <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Etapa da peça</h3><StageSelect card={card} busy={busy||!!dirty} onMove={(id,target)=>void moveStage(id,target)}/><p className="text-xs text-muted-foreground">A mudança é salva na hora e fica registrada no histórico.</p></section>
      <PublicationDetails key={`${card.id}:${card.version}`} card={card} disabled={busy||!!dirty} onSaved={async()=>{await load();await open(card.id)}}/>
      <details className="border-t pt-4"><summary className="cursor-pointer min-h-11 font-semibold text-sm mb-3">Histórico desta peça</summary>{!events.length?<p className="text-xs text-muted-foreground">Arquivo importado do ClickUp. Ainda não há aprovação registrada nesta Central.</p>:<ol className="space-y-4">{events.map(e=><li key={e.id} className="text-xs pl-3 border-l-2 border-primary/30"><p className="font-medium">{actionLabel[e.action]||e.action} · v{e.revision}</p><p className="text-muted-foreground mt-1">{e.actor} · {socialDate(e.created_at)}</p>{e.action==='mover'&&<p className="mt-1">{SOCIAL_STAGES.find(s=>s.id===e.details.from)?.label} → {SOCIAL_STAGES.find(s=>s.id===e.details.to)?.label}</p>}{e.details.evidence&&<p className="mt-1 whitespace-pre-wrap">{e.details.evidence}</p>}{['ajustes','cliente_ajustes','cliente_reprovar'].includes(e.action)&&<p className="mt-1 whitespace-pre-wrap">{e.details.note}</p>}</li>)}</ol>}</details>
     </div>
    </div>
   </>}
  </SheetContent></Sheet>
 </main>
}
