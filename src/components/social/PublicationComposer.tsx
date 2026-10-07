import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {Loader2,Send,CalendarClock,ImagePlus} from 'lucide-react'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {Input} from '@/components/ui/input'
import {socialApi,type Card,socialDate} from '@/lib/social-board'
import CaptionAssistant from './CaptionAssistant'
type Account={id:string;username:string;name:string}
type Job={id:string;status:string;account_username:string;format:string;scheduled_at:string;error?:string;permalink?:string}
const labels:Record<string,string>={queued:'Na fila de publicação',preparing:'Preparando os arquivos',processing:'Instagram processando',publishing:'Enviando ao Instagram',uncertain:'Conferindo o envio',published:'Publicado',failed:'Publicação não concluída',canceled:'Programação cancelada'}
const active=(j:Job|null)=>!!j&&['queued','preparing','processing','publishing','uncertain'].includes(j.status)
/** Mostra o quadro do vídeo num instante, sem canvas: vídeo de outra origem
 * suja o canvas e a extração falharia calada. */
function QuadroDoVideo({src,segundo}:{src?:string;segundo:number}){
 const ref=useRef<HTMLVideoElement>(null)
 return <video ref={ref} src={src} muted playsInline preload="metadata" tabIndex={-1}
  onLoadedMetadata={e=>{try{e.currentTarget.currentTime=segundo}catch{/* instante fora do vídeo */}}}
  className="block h-24 w-full bg-black object-cover"/>
}

export default function PublicationComposer({ids,cards,onClose,onChanged,schedule=false}:{ids:string[];cards:Card[];onClose:()=>void;onChanged:()=>void;schedule?:boolean}){
 const [id,setId]=useState(ids[0]),[card,setCard]=useState<Card|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[job,setJob]=useState<Job|null>(null)
 const [account,setAccount]=useState(''),[formatos,setFormatos]=useState<string[]>([]),[caption,setCaption]=useState(''),[when,setWhen]=useState(schedule?'later':'now'),[date,setDate]=useState('')
 const [cover,setCover]=useState<{path:string;preview:string}|null>(null),[offset,setOffset]=useState(0),[moment,setMoment]=useState(0),[duracao,setDuracao]=useState(0)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false)
 const video=useRef<HTMLVideoElement>(null),request=useRef(crypto.randomUUID()),read=useRef(0),submitted=useRef(false)
 // Cada formato é um envio distinto e precisa do próprio identificador, senão o
 // segundo é tratado como repetição do primeiro e devolve o mesmo job.
 const pedidos=useRef<Record<string,string>>({})
 const pedidoDe=(formato:string)=>(pedidos.current[formato]??=crypto.randomUUID())
 const load=useCallback(async(initialize=false)=>{const n=++read.current;try{const d=await socialApi('?publication=1&id='+encodeURIComponent(id));if(n!==read.current)return;setCard(d.card);setAccounts(d.accounts);setJob(d.publication);if(initialize){setCaption(d.card.caption);const selected=d.card.assets.filter((a:any)=>d.card.selected_assets.includes(a.id));setFormatos([selected.length>1?'carousel':selected[0]?.type.startsWith('video/')?'reel':'image']);if(d.suggested_account)setAccount(d.suggested_account)}}catch(e){if(n===read.current)setError((e as Error).message)}finally{if(n===read.current)setLoading(false)}},[id])
 useEffect(()=>{setLoading(true);setCard(null);setAccount('');setCover(null);setOffset(0);setMoment(0);setError('');setDone(false);submitted.current=false;request.current=crypto.randomUUID();pedidos.current={};void load(true);return()=>{read.current++}},[load])
 useEffect(()=>{if(!active(job))return;const t=setInterval(()=>void load(),7000);return()=>clearInterval(t)},[job?.status,load])
 useEffect(()=>{if(job?.status==='failed'){request.current=crypto.randomUUID();pedidos.current={};submitted.current=false}},[job?.id,job?.status])
 // Três instantes do próprio vídeo, como o gerenciador da Meta oferece: o
 // começo costuma pegar o rosto, e os outros dois cobrem o meio da fala.
 const sugestoesDeCapa=useMemo(()=>duracao>0.6?[0,duracao*0.25,duracao*0.5].map(s=>Math.min(s,Math.max(0,duracao-0.1))):[0],[duracao])
 const format=formatos[0]||''
 const completed=card?.stage==='postado'||job?.status==='published'
 const files=card?.selected_assets.map(id=>card.assets.find(a=>a.id===id)).filter(Boolean)||[],first=files[0],locked=busy||active(job)||completed
 const opcoesDeFormato=useMemo(()=>{
  if(files.length>1)return [{id:'carousel',rotulo:'Carrossel no feed'},{id:'story',rotulo:'Story'}]
  const ehVideo=!!first?.type.startsWith('video/')
  return [{id:ehVideo?'reel':'image',rotulo:ehVideo?'Reels':'Imagem no feed'},{id:'story',rotulo:'Story'}]
 },[files.length,first?.type])
 const chooseCover=async(file:File)=>{
  if(!file.type.startsWith('image/'))return setError('Escolha uma imagem para a capa.')
  setBusy(true);setError('')
  try{const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas'),scale=Math.min(1,1080/bitmap.width,1920/bitmap.height);canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const d=await socialApi('',{action:'publication_cover',image:canvas.toDataURL('image/jpeg',0.9)});setCover(d)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const submit=async()=>{
  if(!card||busy||locked)return
  if(!account)return setError('Escolha a conta do Instagram que receberá esta peça.')
  if(!formatos.length)return setError('Escolha ao menos um lugar para publicar.')
  if(when==='later'&&!date)return setError('Escolha o dia e a hora da postagem.')
  setBusy(true);setError('');submitted.current=true
  // Uma publicação por formato, cada uma com pedido próprio: reel e story são
  // envios distintos. O feed vai primeiro, porque o story costuma apontar pra ele.
  const ordem=[...formatos].sort((a,b)=>(a==='story'?1:0)-(b==='story'?1:0))
  try{
   let ultimo=null
   for(const formato of ordem){
    const d=await socialApi('',{action:'publication_enqueue',id:card.id,version:card.version,request_id:pedidoDe(formato),confirmed:true,account_id:account,format:formato,caption,when,scheduled_at:when==='later'?new Date(date+':00-03:00').toISOString():null,cover_path:cover?.path||null,cover_offset_ms:offset})
    ultimo=d.publication
   }
   setJob(ultimo);setDone(true);onChanged();void load()
  }catch(e){setError((e as Error).message);await load()}finally{setBusy(false)}
 }
 // An edit after a failed request represents a new intent; successful/pending jobs stay locked.
 const revise=()=>{if(submitted.current){request.current=crypto.randomUUID();pedidos.current={};submitted.current=false}}
 const cancel=async()=>{if(!card||!job||busy)return;setBusy(true);setError('');try{await socialApi('',{action:'publication_cancel',id:card.id,version:card.version,job_id:job.id});request.current=crypto.randomUUID();pedidos.current={};setDone(false);onChanged();await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose()}}><DialogContent className="w-[calc(100%-1rem)] max-w-3xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6" onPointerDownOutside={e=>{if(busy)e.preventDefault()}} onEscapeKeyDown={e=>{if(busy)e.preventDefault()}}><DialogHeader><DialogTitle>{schedule?'Programar postagem':card?.stage==='aprovado'?'Peça aprovada. Publicar agora?':'Publicar ou programar'}</DialogTitle><DialogDescription>Confira a conta, a legenda e a capa. O envio começa depois da sua confirmação.</DialogDescription></DialogHeader>
 {ids.length>1&&<label className="text-sm">Peças aprovadas<select aria-label="Peça para publicar" value={id} disabled={busy} onChange={e=>setId(e.target.value)} className="mt-2 w-full h-11 border rounded-lg bg-background px-3">{ids.map(id=><option value={id} key={id}>{cards.find(c=>c.id===id)?.title||id}</option>)}</select></label>}
 {loading?<p className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin"/>Carregando publicação…</p>:card&&<>
 <div><p className="text-xs uppercase tracking-wider text-primary">{card.client}</p><h3 className="font-medium mt-1">{card.title}</h3></div>
 {job&&<div className="rounded-xl border bg-muted/30 p-3 space-y-2" role="status"><p className="font-medium">{labels[job.status]||job.status} · @{job.account_username}</p><p className="text-sm text-muted-foreground">{socialDate(job.scheduled_at)}{active(job)?' · Você pode fechar esta janela.':''}</p>{job.error&&<p className="text-sm">{job.error}</p>}{done&&active(job)&&<p className="text-sm">Postado será marcado quando o Instagram confirmar.</p>}{job.permalink&&<a href={job.permalink} target="_blank" rel="noreferrer" className="text-primary underline">Ver no Instagram</a>}{['queued','preparing','processing','failed'].includes(job.status)&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void cancel()}>Cancelar programação</Button>}</div>}
 {completed&&!job&&<p role="status" className="text-sm">Esta peça já está em Postado. Consulte o registro de publicação nos detalhes.</p>}
 {!active(job)&&!completed&&<div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
 <div className="space-y-3 min-w-0">{first?.type.startsWith('video/')?<><video ref={video} key={first.id} controls playsInline preload="metadata" poster={first.preview} src={first.playback_url||first.url} className="w-full max-h-80 rounded-xl bg-black object-contain" onTimeUpdate={e=>setMoment(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuracao(e.currentTarget.duration||0)} />{format==='reel'&&<><div><p className="text-sm font-medium mb-2">Capa do reel</p><div className="grid grid-cols-3 gap-2">{sugestoesDeCapa.map(segundo=><button key={segundo} type="button" disabled={busy} onClick={()=>{setOffset(Math.round(segundo*1000));setCover(null);revise()}} className={`relative overflow-hidden rounded-lg border-2 transition-colors ${!cover&&Math.abs(offset/1000-segundo)<0.05?'border-primary':'border-transparent hover:border-primary/40'}`}><QuadroDoVideo src={first.playback_url||first.url} segundo={segundo}/><span className="absolute bottom-0 inset-x-0 bg-black/70 py-0.5 text-[10px] text-white">{segundo.toFixed(1)}s</span></button>)}</div></div><Button className="w-full" variant="outline" disabled={busy} onClick={()=>{setOffset(Math.round((video.current?.currentTime||0)*1000));setCover(null);revise()}}>Usar momento {moment.toFixed(1)}s como capa</Button><p className="text-xs text-muted-foreground">{cover?'Capa enviada por você.':`Capa no instante ${(offset/1000).toFixed(1)}s do vídeo.`}</p><label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border p-2 text-sm"><ImagePlus className="h-4 w-4"/>Enviar outra capa<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f){revise();void chooseCover(f)}e.target.value=''}}/></label>{cover&&<img src={cover.preview} alt="Capa escolhida" className="max-h-52 w-full object-contain rounded-lg"/>}</>}</>:<div className="grid grid-cols-2 gap-2">{files.map(a=>a&&<img key={a.id} src={a.url||a.preview} alt={a.name} className="w-full rounded-lg object-contain"/>)}</div>}<p className="text-xs text-muted-foreground">{files.length} arquivo{files.length===1?'':'s'} · ordem da peça</p></div>
 <div className="space-y-4 min-w-0"><label className="block text-sm font-medium">Conta do Instagram<select aria-label="Conta do Instagram" value={account} onChange={e=>{setAccount(e.target.value);revise()}} disabled={busy} className="mt-2 w-full h-11 rounded-lg border bg-background px-3"><option value="">Selecione a conta do cliente</option>{accounts.map(a=><option key={a.id} value={a.id}>@{a.username} · {a.name}</option>)}</select></label><fieldset className="space-y-2"><legend className="text-sm font-medium">Onde publicar</legend>{opcoesDeFormato.map(o=><label key={o.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={formatos.includes(o.id)} disabled={busy} onChange={e=>{setFormatos(atual=>e.target.checked?[...atual,o.id]:atual.filter(v=>v!==o.id));revise()}}/>{o.rotulo}</label>)}<p className="text-xs text-muted-foreground">{formatos.length>1?'Sai nos dois, uma publicação para cada.':'Marque os dois para sair no feed e no story.'}</p></fieldset>{format!=='story'&&<><label className="block text-sm font-medium">Legenda<Textarea aria-label="Legenda da publicação" value={caption} onChange={e=>{setCaption(e.target.value);revise()}} disabled={busy} rows={7} maxLength={2200} className="mt-2 text-base"/></label><p className="text-xs text-muted-foreground text-right">{caption.length}/2.200</p><CaptionAssistant card={card} disabled={busy} onGenerated={v=>{setCaption(v);revise()}}/></>}
 <fieldset className="space-y-2"><legend className="text-sm font-medium mb-2">Quando publicar?</legend><div className="flex flex-wrap gap-4"><label className="flex min-h-11 items-center gap-2"><input type="radio" checked={when==='now'} disabled={busy} onChange={()=>{setWhen('now');revise()}}/>Agora</label><label className="flex min-h-11 items-center gap-2"><input type="radio" checked={when==='later'} disabled={busy} onChange={()=>{setWhen('later');revise()}}/>Escolher horário</label></div>{when==='later'&&<label className="block text-sm">Data e hora · Belém (UTC−3)<Input type="datetime-local" value={date} disabled={busy} onChange={e=>{setDate(e.target.value);revise()}} className="mt-2 text-base"/></label>}</fieldset></div></div>}
 </>}
 {error&&<p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
 <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={busy} onClick={onClose}>{active(job)||completed?'Fechar':'Agora não'}</Button>{card&&!active(job)&&!completed&&<Button disabled={busy||loading||!account||!formatos.length||caption.length>2200} onClick={()=>void submit()}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:when==='now'?<Send className="h-4 w-4"/>:<CalendarClock className="h-4 w-4"/>}{when==='now'?'Publicar agora':'Programar postagem'}</Button>}</div>
 </DialogContent></Dialog>
}
