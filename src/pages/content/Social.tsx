import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { ArrowUp, ArrowDown, Check, CheckCircle2, Clock3, Copy, Download, ExternalLink, ImageIcon, Link2, Loader2, RefreshCw, Search, X, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { socialApi, SOCIAL_STAGES, socialDate, localInput, type Card } from '@/lib/social-board'
import { useToast } from '@/hooks/use-toast'

type Event = {id:number; action:string; actor:string; revision:number; created_at:string; details:{from:string;to:string;evidence?:string;note?:string}}
const actionLabel:Record<string,string>={editar:'Atualizou a peça',solicitar:'Gerou link de aprovação',aprovar:'Registrou aprovação',cliente_aprovar:'Aprovou pelo link',ajustes:'Pediu ajustes',cliente_ajustes:'Pediu ajustes pelo link',agendar:'Agendou a postagem',postar:'Confirmou a postagem',arquivar:'Arquivou',conferir:'Voltou para conferência',importar:'Recebeu novos arquivos',receber:'Recebeu uma nova entrega'}
const cleanTitle=(s:string)=>s.replace(/^(HOJE|AMANHÃ|QUA|QUI|SEX|SEG|TER|SÁB|SAB|DOM)[^·]*·\s*/i,'')

export default function Social() {
 const [params,setParams]=useSearchParams(); const {toast}=useToast()
 const [sync,setSync]=useState<{sources:{id:string;label:string;enabled:boolean;last_success_at:string|null;error:string|null}[];pending:number;issues:{key:string;title:string;source_url:string;reason:string}[]}|null>(null);
 const [editClient,setEditClient]=useState('');const [editTitle,setEditTitle]=useState('');
 const [cards,setCards]=useState<Card[]>([]); const [loading,setLoading]=useState(true);const [error,setError]=useState('')
 const [query,setQuery]=useState('');const [client,setClient]=useState(params.get('cliente')||'');const [author,setAuthor]=useState('');const [stage,setStage]=useState('');const [archived,setArchived]=useState(false)
 const [card,setCard]=useState<Card|null>(null);const [events,setEvents]=useState<Event[]>([]);const [detailLoading,setDetailLoading]=useState(false);const [busy,setBusy]=useState(false)
 const [caption,setCaption]=useState('');const [note,setNote]=useState('');const [selected,setSelected]=useState<string[]>([])
 const [action,setAction]=useState('');const [name,setName]=useState('');const [evidence,setEvidence]=useState('');const [reason,setReason]=useState('');const [date,setDate]=useState(localInput());const [channel,setChannel]=useState('Instagram · Feed');const [postUrl,setPostUrl]=useState('');const [confirmed,setConfirmed]=useState(false);const [approvalUrl,setApprovalUrl]=useState('')
 const detailRequest=useRef(0);const pendingAction=useRef('')
 const notify=(message:string)=>toast({description:message})
 const load=useCallback(async()=>{try {setError('');const [data,status]=await Promise.all([socialApi(),socialApi('?sync=status')]);setCards(data.cards);setSync(status)}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[])
 const open=useCallback(async(id:string)=>{const request=++detailRequest.current;setDetailLoading(true);setCard(null);setAction('');setApprovalUrl('');try{const d=await socialApi('?id='+encodeURIComponent(id));if(request!==detailRequest.current)return;setCard(d.card);setEditClient(d.card.client);setEditTitle(d.card.title);setEvents(d.events);setCaption(d.card.caption);setNote(d.card.note);setSelected(d.card.selected_assets);setChannel(d.card.channel||'Instagram · Feed');setName('');setEvidence('');setReason('');setPostUrl('');setConfirmed(false);setAction(pendingAction.current);pendingAction.current=''}catch(e){if(request===detailRequest.current)setError((e as Error).message)}finally{if(request===detailRequest.current)setDetailLoading(false)}},[])
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer)},[load])
 const cardId=params.get('peca')
 useEffect(()=>{if(cardId)void open(cardId);else setCard(null)},[cardId,open])
 const choose=(id:string)=>setParams(p=>{p.set('peca',id);return p})
 const close=()=>{if(busy)return;detailRequest.current++;pendingAction.current='';setCard(null);setAction('');setParams(p=>{p.delete('peca');return p})}
 const clients=useMemo(()=>[...new Set(cards.map(c=>c.client))].sort((a,b)=>a.localeCompare(b)),[cards])
 const authors=useMemo(()=>[...new Set(cards.map(c=>c.author))].sort(),[cards])
 const filtered=cards.filter(c=>(!client||c.client===client)&&(!author||c.author===author)&&(!query||`${c.title} ${c.client} ${c.note}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(archived||c.stage!=='arquivado'))
 const columns=SOCIAL_STAGES.filter(s=>(archived||s.id!=='arquivado')&&(!stage||s.id===stage))
 const dirty=card&&(editClient!==card.client||editTitle!==card.title||caption!==card.caption||note!==card.note||JSON.stringify(selected)!==JSON.stringify(card.selected_assets))
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);notify('Copiado.')}catch{notify('Não foi possível copiar. Selecione o texto e copie.')}}
 const save=async(kind:string)=>{
  if(!card||busy)return;setBusy(true)
  try{
   const data=await socialApi('',{id:card.id,version:card.version,action:kind,client:editClient,title:editTitle,caption,note,selected_assets:selected,name,evidence,reason,scheduled_at:kind==='agendar'?new Date(date).toISOString():undefined,posted_at:kind==='postar'?new Date(date).toISOString():undefined,channel,posted_url:postUrl,confirmed})
   await load();await open(card.id);if(data.approval_url)setApprovalUrl(data.approval_url)
   notify(kind==='solicitar'?'Link pronto. Copie e compartilhe com o cliente.':'Registro salvo para toda a equipe.')
  }catch(e){notify((e as Error).message)}finally{setBusy(false)}
 }
 const requestAction=(value:string)=>{if(dirty){notify('Salve os arquivos, a legenda e as observações antes de mudar a etapa.');return}setAction(value);setDate(localInput());setConfirmed(false)}
 const drag=async(result:DropResult)=>{
  if(!result.destination||result.destination.droppableId===result.source.droppableId)return
  const target=result.destination.droppableId;pendingAction.current=({aguardando:'solicitar',aprovado:'aprovar',agendado:'agendar',postado:'postar'} as Record<string,string>)[target]||target
  if(cardId===result.draggableId)await open(result.draggableId);else choose(result.draggableId)
 }
 const reorder=(id:string,delta:number)=>setSelected(previous=>{const i=previous.indexOf(id),j=i+delta;if(i<0||j<0||j>=previous.length)return previous;const next=[...previous];[next[i],next[j]]=[next[j],next[i]];return next})
 return <main className="space-y-6 min-w-0">
  <header className="flex flex-wrap items-start justify-between gap-4">
   <div><p className="text-[11px] font-semibold tracking-[.22em] text-primary uppercase">Conteúdo · Central SVI</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">O que vamos postar?</h1><p className="mt-2 text-sm text-muted-foreground max-w-2xl">A arte, o vídeo, a legenda e a aprovação no mesmo lugar. Abra o card para conferir a versão e registrar o próximo passo.</p></div>
   <div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link to="/content/organizador">Produção / Organizador</Link></Button><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="w-4 h-4 mr-2"/>Atualizar</Button></div>
  </header>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
   {[{id:'aprovado',label:'Prontos para postar',icon:CheckCircle2},{id:'aguardando',label:'Esperando resposta',icon:Clock3},{id:'ajustes',label:'Precisam de ajuste',icon:ImageIcon},{id:'agendado',label:'Na agenda',icon:Check}].map(item=><button key={item.id} onClick={()=>setStage(stage===item.id?'':item.id)} className={`text-left rounded-xl border p-4 flex items-center justify-between transition-colors ${stage===item.id?'border-primary bg-primary/10':'bg-card hover:border-primary/50'}`}><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-3xl font-semibold mt-1">{filtered.filter(c=>c.stage===item.id).length}</p></div><item.icon className="h-5 w-5 text-primary/80"/></button>)}
  </div>
  <section className="flex flex-wrap items-center gap-2" aria-label="Filtros do quadro">
   <div className="relative flex-1 min-w-[190px]"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Buscar peça" placeholder="Buscar peça ou assunto" className="pl-9" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <select aria-label="Cliente" className="h-10 max-w-full rounded-md border bg-background px-3 text-sm" value={client} onChange={e=>{setClient(e.target.value);setParams(p=>{e.target.value?p.set('cliente',e.target.value):p.delete('cliente');return p})}}><option value="">Todos os clientes</option>{clients.map(c=><option key={c}>{c}</option>)}</select>
   <select aria-label="Responsável" className="h-10 rounded-md border bg-background px-3 text-sm" value={author} onChange={e=>setAuthor(e.target.value)}><option value="">Todos os responsáveis</option>{authors.map(a=><option key={a}>{a}</option>)}</select>
   <select aria-label="Etapa" className="h-10 rounded-md border bg-background px-3 text-sm" value={stage} onChange={e=>{setStage(e.target.value);if(e.target.value==='arquivado')setArchived(true)}}><option value="">Quadro completo</option>{SOCIAL_STAGES.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select>
   <label className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><input type="checkbox" checked={archived} onChange={e=>{setArchived(e.target.checked);if(!e.target.checked&&stage==='arquivado')setStage('')}}/>Mostrar arquivo</label>
  </section>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{filtered.length} peças · {filtered.reduce((n,c)=>n+c.assets.length,0)} arquivos · acervo da equipe</span><span>Aprovações antigas sem comprovação entram em conferência.</span></div>
  {sync&&<details className="rounded-lg border bg-card p-3 text-xs"><summary className="cursor-pointer flex flex-wrap items-center gap-2"><RefreshCw className="w-3 h-3"/>Entrada automática · ClickUp e vídeos do Math{sync.pending>0&&<span className="text-muted-foreground">{sync.pending} na fila</span>}{(sync.issues.length>0||sync.sources.some(s=>s.error||!s.last_success_at||Date.now()-Date.parse(s.last_success_at)>15*60000))&&<span className="text-orange-400">Conferir sincronização</span>}</summary><div className="mt-3 space-y-3"><p className="text-muted-foreground">Novos uploads de José, Laís e Math no ClickUp. Consulta a cada 2 minutos; o quadro se atualiza a cada minuto. No grupo, Math pode identificar o vídeo com CLIENTE | TÍTULO | V1. Uma correção usa o mesmo título e V2. Envie como documento para preservar o arquivo. Entrega nova exige conferência.</p><div className="flex flex-wrap gap-3">{sync.sources.map(s=><p key={s.id}>{s.label}: <span className={s.error?'text-orange-400':'text-muted-foreground'}>{s.error?'consulta pendente':s.last_success_at?socialDate(s.last_success_at):'primeira consulta pendente'}</span></p>)}</div>{sync.issues.map(i=><div key={i.key} className="border-l-2 border-orange-400 pl-3"><p className="font-medium">{i.title}</p><p className="text-muted-foreground">{i.reason}</p><a className="underline text-primary" href={i.source_url} target="_blank" rel="noreferrer">Conferir na origem</a></div>)}</div></details>}
  {error&&<div role="alert" className="p-4 rounded-lg border border-destructive/40 text-destructive">{error}<Button variant="ghost" size="sm" onClick={()=>void load()}>Tentar novamente</Button></div>}
  {loading?<div className="flex gap-2 items-center py-16 text-muted-foreground"><Loader2 className="animate-spin h-5 w-5"/>Carregando o quadro…</div>:<DragDropContext onDragEnd={drag}>
   <div className="flex gap-4 overflow-x-auto pb-5 items-start" aria-label="Kanban de postagens">
    {columns.map(s=>{const group=filtered.filter(c=>c.stage===s.id);return <section key={s.id} className={`${stage?'w-full max-w-4xl':'w-[280px] md:w-[300px]'} shrink-0 rounded-xl border bg-muted/20 overflow-hidden`}>
     <div className="h-1" style={{background:s.color}}/><div className="p-4 border-b"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{s.label}</h2><span className="text-xs rounded-md bg-muted px-2 py-1">{group.length}</span></div><p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p></div>
     <Droppable droppableId={s.id}>{provided=><div ref={provided.innerRef} {...provided.droppableProps} className={`p-3 min-h-[190px] max-h-[66vh] overflow-y-auto ${stage?'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3':'space-y-3'}`}>
      {group.map((c,index)=><Draggable disableInteractiveElementBlocking key={c.id} draggableId={c.id} index={index} isDragDisabled={busy||c.stage==='postado'}>{p=><article ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="rounded-lg border bg-card hover:border-primary/60 transition-colors overflow-hidden cursor-grab" onClick={e=>{if(!e.defaultPrevented)choose(c.id)}}>
       <button className="block text-left w-full" aria-label={`Abrir ${c.title}`} onClick={e=>{e.stopPropagation();choose(c.id)}}>
        {c.preview&&((c.assets.find(a=>a.id===c.selected_assets[0])||c.assets[0])?.thumbnail||(c.assets.find(a=>a.id===c.selected_assets[0])||c.assets[0])?.type.startsWith('image/'))?<img src={c.preview} alt="" loading="lazy" className="w-full h-40 object-contain bg-black/15"/>:<div className="h-24 bg-muted flex items-center justify-center">{c.assets.some(a=>a.type.startsWith('video/'))?<Video className="h-8 w-8 text-muted-foreground"/>:<ImageIcon className="h-8 w-8 text-muted-foreground"/>}</div>}
        <div className="p-3 space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{c.client}</p><h3 className="text-sm leading-snug line-clamp-3 font-medium">{cleanTitle(c.title)}</h3>
         {c.ingest_pending&&<p className="text-[11px] text-orange-400">Importação pendente · conferir sincronização</p>}
         {c.stage==='ajustes'&&c.note&&<p className="text-[11px] line-clamp-2 text-orange-400">{c.note}</p>}
         {c.approved_by&&<p className="text-[11px] text-emerald-500">Aprovado por {c.approved_by}</p>}
         {c.scheduled_at&&c.stage==='agendado'&&<p className="text-[11px] text-primary">{socialDate(c.scheduled_at)} · {c.channel}</p>}
         {c.posted_at&&<p className="text-[11px] text-muted-foreground">Postado {socialDate(c.posted_at)}</p>}
         <div className="pt-2 border-t flex justify-between text-[10px] text-muted-foreground"><span>{c.author} · {c.assets.length} arquivo{c.assets.length!==1?'s':''}</span><span>v{c.revision}</span></div>
        </div>
       </button>
      </article>}</Draggable>)}{provided.placeholder}{!group.length&&<p className="text-xs text-muted-foreground p-4 text-center">Nenhuma peça nesta etapa.</p>}
     </div>}</Droppable>
    </section>})}
   </div>
  </DragDropContext>}
  <Sheet open={!!cardId} onOpenChange={value=>{if(!value)close()}}><SheetContent className="w-full sm:max-w-5xl overflow-y-auto p-5 sm:p-8">
   {!card?<SheetHeader><SheetTitle>{detailLoading?'Carregando peça…':'Peça indisponível'}</SheetTitle><SheetDescription>Arquivos e histórico da publicação.</SheetDescription></SheetHeader>:<>
    <SheetHeader><p className="text-xs text-primary uppercase tracking-widest">{card.client} · versão {card.revision}</p><SheetTitle className="text-xl pr-5">{cleanTitle(card.title)}</SheetTitle><SheetDescription>{SOCIAL_STAGES.find(s=>s.id===card.stage)?.label} · {card.author}</SheetDescription></SheetHeader>
    {card.ingest_pending&&<p className="mt-4 rounded border border-orange-400/40 p-3 text-xs text-orange-400">Uma entrega nova está sendo importada. A aprovação fica bloqueada até os arquivos estarem disponíveis. Consulte a sincronização no quadro se houver demora.</p>}
    <div className="mt-6 grid lg:grid-cols-[1.05fr_1fr] gap-7">
     <div className="space-y-5">
      <div><h3 className="font-semibold text-sm">Arquivos da peça</h3><p className="text-xs text-muted-foreground mt-1">Selecione os arquivos finais. As setas definem a ordem do carrossel.</p></div>
      <div className="grid grid-cols-2 gap-3">{card.assets.map(a=>{const pos=selected.indexOf(a.id);return <div key={a.id} className={`border rounded-lg overflow-hidden ${pos>=0?'border-primary/70':'opacity-65'}`}>
       {a.type.startsWith('video/')?<video src={a.url} controls playsInline preload="metadata" className="w-full h-52 bg-black"/>:a.type.startsWith('image/')&&a.preview?<a href={a.url} target="_blank" rel="noreferrer"><img className="w-full h-44 object-contain bg-black/10" src={a.preview} alt={a.name}/></a>:<a href={a.url} target="_blank" rel="noreferrer" className="h-32 flex items-center justify-center text-sm">Abrir arquivo</a>}
       <div className="p-2 space-y-2"><p className="text-[10px] break-words line-clamp-2" title={a.name}>{a.name}</p><label className="flex items-center gap-2 text-xs"><input disabled={busy||card.stage==='postado'} type="checkbox" checked={pos>=0} onChange={e=>setSelected(p=>e.target.checked?[...p,a.id]:p.filter(id=>id!==a.id))}/>{pos>=0?`${pos+1} · Arquivo final`:'Incluir na versão'}</label>
        <div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" disabled={pos<=0||busy||card.stage==='postado'} aria-label={`Subir ${a.name}`} onClick={()=>reorder(a.id,-1)}><ArrowUp className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="h-7 w-7" disabled={pos<0||pos===selected.length-1||busy||card.stage==='postado'} aria-label={`Descer ${a.name}`} onClick={()=>reorder(a.id,1)}><ArrowDown className="h-3 w-3"/></Button><a href={a.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-primary flex items-center gap-1"><Download className="h-3 w-3"/>Original</a></div>
       </div>
      </div>})}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href={card.source_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-2"/>{card.source_url.includes('clickup.com')?'Tarefa no ClickUp':'Abrir WhatsApp'}</a></Button><Button variant="outline" size="sm" onClick={()=>void copy(`${window.location.origin}/content/social?peca=${card.id}`)}><Link2 className="h-3 w-3 mr-2"/>Link interno</Button></div>
      <details className="text-xs rounded-lg border p-3"><summary className="cursor-pointer font-medium">Briefing e origem</summary><p className="text-muted-foreground mt-3">Status coletado: {card.source_status} · arquivo de {socialDate(card.source_updated)}. Esse status não comprova aprovação nem postagem.</p><p className="whitespace-pre-wrap mt-3 text-muted-foreground max-h-72 overflow-y-auto">{card.source_description||'Consulte a tarefa de origem.'}</p></details>
     </div>
     <div className="space-y-5">
      <div className="space-y-3"><div><label htmlFor="social-client" className="text-sm font-semibold">Cliente</label><Input id="social-client" list="social-clients" value={editClient} onChange={e=>setEditClient(e.target.value)} disabled={busy||card.stage==='postado'} className="mt-1"/><datalist id="social-clients">{clients.filter(c=>c!=='Identificar cliente').map(c=><option key={c} value={c}/>)}</datalist></div><div><label htmlFor="social-title" className="text-sm font-semibold">Título da peça</label><Input id="social-title" value={editTitle} onChange={e=>setEditTitle(e.target.value)} disabled={busy||card.stage==='postado'} className="mt-1"/></div></div>
      <div><label htmlFor="social-caption" className="text-sm font-semibold">Legenda final</label><Textarea id="social-caption" disabled={busy||card.stage==='postado'} value={caption} onChange={e=>setCaption(e.target.value)} className="min-h-40 mt-2" placeholder="Cole aqui a legenda que acompanha esta versão."/><Button disabled={!caption} size="sm" variant="ghost" onClick={()=>void copy(caption)}><Copy className="h-3 w-3 mr-2"/>Copiar legenda</Button></div>
      <div><label htmlFor="social-note" className="text-sm font-semibold">Observação da equipe</label><Textarea id="social-note" disabled={busy||card.stage==='postado'} value={note} onChange={e=>setNote(e.target.value)} className="min-h-20 mt-2"/><p className="text-[11px] text-muted-foreground mt-1">Visível somente para a equipe.</p></div>
      {dirty&&<div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2"><p className="text-xs">Alterar os arquivos ou a legenda exige nova aprovação. O histórico anterior fica registrado.</p><Button disabled={busy} size="sm" onClick={()=>void save('editar')}>Salvar versão</Button></div>}
      {card.approved_by&&<div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-4"><p className="text-sm font-medium">Aprovado por {card.approved_by}</p><p className="text-xs text-muted-foreground mt-1">Registrado em {socialDate(card.approved_at)} · versão {card.revision}</p><p className="text-xs mt-2 whitespace-pre-wrap">{card.approval_evidence}</p></div>}
      {card.stage==='postado'?<div className="rounded-lg border p-4"><p className="font-medium">Postagem registrada em {socialDate(card.posted_at)}</p><p className="text-sm text-muted-foreground">{card.channel}</p>{card.posted_url&&<a href={card.posted_url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">Abrir publicação</a>}</div>:<div className="space-y-3 border-t pt-4"><p className="text-sm font-semibold">Próximo passo</p><div className="flex gap-2 flex-wrap">
       <Button disabled={busy||!!dirty} size="sm" onClick={()=>requestAction('solicitar')}><Link2 className="h-3 w-3 mr-1"/>Gerar link para aprovar</Button>
       <Button disabled={busy||!!dirty} variant="outline" size="sm" onClick={()=>requestAction('aprovar')}>Registrar aprovação</Button>
       <Button disabled={busy||!!dirty} variant="outline" size="sm" onClick={()=>requestAction('ajustes')}>Pedir ajuste</Button>
       {['aprovado','agendado'].includes(card.stage)&&<><Button disabled={busy||!!dirty} variant="outline" size="sm" onClick={()=>requestAction('agendar')}>Agendar</Button><Button disabled={busy||!!dirty} variant="outline" size="sm" onClick={()=>requestAction('postar')}>Marcar postado</Button></>}
       <Button disabled={busy||!!dirty} variant="ghost" size="sm" onClick={()=>requestAction(card.stage==='arquivado'?'conferir':'arquivar')}>{card.stage==='arquivado'?'Reabrir':'Arquivar'}</Button>
      </div></div>}
      {approvalUrl&&<div className="p-4 border border-primary/40 rounded-lg bg-primary/5 space-y-2"><p className="text-sm font-medium">Link de aprovação desta versão</p><p className="text-xs text-muted-foreground">O cliente verá os arquivos selecionados e a legenda. Válido por 30 dias. Um novo link substitui o anterior.</p><Input readOnly value={approvalUrl} aria-label="Link de aprovação"/><Button size="sm" onClick={()=>void copy(approvalUrl)}>Copiar link do cliente</Button></div>}
      {action&&<section className="border border-primary/40 rounded-lg p-4 space-y-3 bg-primary/5" aria-label="Registrar próximo passo"><div className="flex justify-between items-center"><h3 className="font-semibold text-sm">{({solicitar:'Solicitar aprovação',aprovar:'Registrar aprovação recebida',ajustes:'Descrever ajustes',agendar:'Agendar postagem',postar:'Registrar postagem',arquivar:'Arquivar peça',conferir:'Voltar para conferência'} as Record<string,string>)[action]}</h3><Button size="icon" variant="ghost" aria-label="Cancelar ação" onClick={()=>setAction('')}><X className="h-4 w-4"/></Button></div>
       {action==='solicitar'&&<p className="text-sm text-muted-foreground">A peça irá para “Aguardando cliente”. Copie o link gerado para compartilhar.</p>}
       {action==='aprovar'&&<><Input aria-label="Quem aprovou" placeholder="Quem aprovou?" value={name} onChange={e=>setName(e.target.value)}/><Textarea aria-label="Comprovante da aprovação" placeholder="Ex.: Maria, no grupo da clínica, em 25/09 às 14h. Mensagem: pode postar esta versão." value={evidence} onChange={e=>setEvidence(e.target.value)}/></>}
       {action==='ajustes'&&<Textarea aria-label="Ajustes necessários" placeholder="O que precisa mudar?" value={reason} onChange={e=>setReason(e.target.value)}/>}
       {['agendar','postar'].includes(action)&&<><label className="block text-xs">{action==='agendar'?'Data planejada':'Quando foi publicado'}<Input aria-label="Data da postagem" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className="mt-1"/></label><Input aria-label="Rede e formato" placeholder="Rede e formato" value={channel} onChange={e=>setChannel(e.target.value)}/><p className="text-xs text-muted-foreground">Este registro organiza o trabalho. A publicação na rede deve ser feita pela equipe.</p></>}
       {action==='postar'&&<><Input aria-label="Link da publicação" placeholder="Link da publicação (opcional para stories)" value={postUrl} onChange={e=>setPostUrl(e.target.value)}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que já publiquei esta peça.</label></>}
       {action==='arquivar'&&<p className="text-sm">A peça sairá da fila e continuará disponível em “Mostrar arquivo”.</p>}
       {action==='conferir'&&<p className="text-sm">A peça volta para revisão e precisará de aprovação para postar.</p>}
       <Button disabled={busy||!!dirty} onClick={()=>void save(action)}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:'Salvar e continuar'}</Button>
      </section>}
      <section className="border-t pt-4"><h3 className="font-semibold text-sm mb-3">Histórico desta peça</h3>{!events.length?<p className="text-xs text-muted-foreground">Arquivo importado do ClickUp. Ainda não há aprovação registrada nesta Central.</p>:<ol className="space-y-4">{events.map(e=><li key={e.id} className="text-xs pl-3 border-l-2 border-primary/30"><p className="font-medium">{actionLabel[e.action]||e.action} · v{e.revision}</p><p className="text-muted-foreground mt-1">{e.actor} · {socialDate(e.created_at)}</p>{e.details.evidence&&<p className="mt-1 whitespace-pre-wrap">{e.details.evidence}</p>}{['ajustes','cliente_ajustes'].includes(e.action)&&<p className="mt-1 whitespace-pre-wrap">{e.details.note}</p>}</li>)}</ol>}</section>
     </div>
    </div>
   </>}
  </SheetContent></Sheet>
 </main>
}
