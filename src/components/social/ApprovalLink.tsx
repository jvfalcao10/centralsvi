import {useEffect,useRef,useState} from 'react'
import {Check,Copy,ExternalLink,Link2,Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
export default function ApprovalLink({url,legacy,disabledReason,routingPending,onGenerate}:{url:string;legacy:boolean;disabledReason?:string;routingPending:boolean;onGenerate:()=>Promise<string>}) {
 const [link,setLink]=useState(url),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false)
 const input=useRef<HTMLInputElement>(null)
 useEffect(()=>{setLink(url);setCopied(false);setStatus('');setError('')},[url])
 const select=()=>{input.current?.focus();input.current?.select();input.current?.setSelectionRange(0,link.length)}
 const copy=async()=>{
  if(!link)return;setError('');setStatus('');setCopied(false)
  try{if(!navigator.clipboard?.writeText)throw new Error('clipboard_unavailable');await navigator.clipboard.writeText(link);setCopied(true);setStatus('Link copiado. Agora é só colar na conversa com o cliente.')}
  catch{select();let ok=false;try{ok=document.execCommand('copy')}catch{/* Manual selection remains visible. */}if(ok){setCopied(true);setStatus('Link copiado. Agora é só colar na conversa com o cliente.')}else setStatus('O navegador bloqueou a cópia automática. O link está selecionado: use Copiar no celular ou Ctrl+C / ⌘C no computador.')}
 }
 const generate=async()=>{setBusy(true);setError('');setStatus('');try{const next=await onGenerate();setLink(next);setStatus('Link pronto. Use “Copiar link do cliente” para enviar.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section id="social-approval-link" aria-label="Link para o cliente aprovar" className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3 scroll-mt-6">
  <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-primary"/><h3 className="text-sm font-semibold">Link para o cliente aprovar</h3></div>
  <p className="text-xs text-muted-foreground">O cliente abre o link, assiste e aprova ou descreve a alteração que deseja.</p>
  {link?<><Input ref={input} readOnly value={link} aria-label="Link de aprovação do cliente" onFocus={e=>e.currentTarget.select()} onClick={e=>e.currentTarget.select()}/><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!!disabledReason||busy} onClick={()=>void copy()} aria-label="Copiar link do cliente">{copied?<Check className="w-4 h-4 mr-2"/>:<Copy className="w-4 h-4 mr-2"/>}{copied?'Link copiado':'Copiar link do cliente'}</Button><Button size="sm" variant="outline" asChild><a href={link} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-2"/>Abrir página do cliente</a></Button></div></>:<>
   {legacy&&<p className="text-xs text-muted-foreground">O endereço antigo não ficou salvo. Gere um novo link para copiar; ele substituirá o anterior.</p>}
   <Button size="sm" disabled={!!disabledReason||busy} onClick={()=>void generate()}>{busy?<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Gerando link…</>:legacy?'Gerar novo link do cliente':'Gerar link do cliente'}</Button>
  </>}
  {disabledReason&&<p className="text-xs text-orange-400">{disabledReason}</p>}
  {routingPending&&<p className="text-xs text-muted-foreground">A resposta ficará salva na Central. Vincule o responsável e a tarefa abaixo para enviar o retorno ao grupo e ao ClickUp.</p>}
  {status&&<p role="status" className="text-sm">{status}</p>}{error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
 </section>
}
