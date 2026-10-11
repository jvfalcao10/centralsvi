import {useRef,useState} from 'react'
import {Plus, Upload, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {socialApi} from '@/lib/social-board'
import {toast} from 'sonner'

const ETAPAS=[
 {id:'conferir',label:'Conferir',ajuda:'Entra para alguém olhar antes de seguir'},
 {id:'aguardando',label:'Aguardando cliente',ajuda:'Já pode ir para o cliente aprovar'},
 {id:'ajustes',label:'Em ajuste',ajuda:'Precisa de correção antes de sair'},
 {id:'aprovado',label:'Aprovado para postar',ajuda:'Pauta já fechada, pronta para publicar'},
] as const

const TETO=50*1024*1024
const aceita=(f:File)=>/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime))$/.test(f.type)
const mb=(n:number)=>`${(n/1048576).toFixed(1)} MB`

/**
 * Subir peça que não veio do ClickUp nem do WhatsApp.
 *
 * O arquivo vai do navegador DIRETO para o Supabase, com um endereço assinado
 * que a função devolve. Ele não passa pela função porque o limite de corpo é
 * de cerca de 4,5 MB e vídeo de cliente passa muito disso.
 */
export function NovaPeca({clientes,aoCriar}:{clientes:string[];aoCriar:()=>void}) {
 const [aberto,setAberto]=useState(false)
 const [client,setClient]=useState('')
 const [title,setTitle]=useState('')
 const [stage,setStage]=useState<string>('conferir')
 const [arquivos,setArquivos]=useState<File[]>([])
 const [enviando,setEnviando]=useState(false)
 const [progresso,setProgresso]=useState('')
 const campo=useRef<HTMLInputElement>(null)

 const limpar=()=>{setClient('');setTitle('');setStage('conferir');setArquivos([]);setProgresso('')}

 const somar=(lista:FileList|null)=>{
  if(!lista)return
  const novos=[...lista]
  const recusados=novos.filter(f=>!aceita(f)||f.size>TETO)
  if(recusados.length)toast.error(recusados.some(f=>f.size>TETO)
   ?'Arquivo acima de 50 MB. Exporte o vídeo em H.264 por volta de 6 Mbps.'
   :'Formato não aceito. Envie JPG, PNG, WebP ou MP4.')
  setArquivos(a=>[...a,...novos.filter(f=>aceita(f)&&f.size<=TETO)].slice(0,10))
 }

 const enviar=async()=>{
  setEnviando(true)
  try{
   const prontos=[]
   for(const [i,f] of arquivos.entries()){
    setProgresso(`Enviando ${i+1} de ${arquivos.length}`)
    const {caminho,url}=await socialApi('',{action:'upload_url',nome:f.name,tipo:f.type,bytes:f.size})
    // PUT direto no endereço assinado. O arquivo não passa pela função, que
    // aceita corpo de cerca de 4,5 MB e recusaria qualquer vídeo.
    const envio=await fetch(url,{method:'PUT',headers:{'content-type':f.type},body:f})
    if(!envio.ok)throw new Error(`O envio de "${f.name}" falhou. Tente de novo.`)
    prontos.push({caminho,nome:f.name,tipo:f.type,bytes:f.size})
   }
   setProgresso('Criando a peça')
   await socialApi('',{action:'nova_peca',client,title,stage,arquivos:prontos})
   toast.success('Peça criada no quadro.')
   setAberto(false);limpar();aoCriar()
  }catch(e){toast.error((e as Error).message)}
  finally{setEnviando(false);setProgresso('')}
 }

 const podeEnviar=client.trim().length>1&&title.trim().length>2&&arquivos.length>0&&!enviando

 return (
  <>
   <Button onClick={()=>setAberto(true)} className="min-h-11 md:min-h-10">
    <Plus className="mr-1 h-4 w-4"/>Nova peça
   </Button>

   <Dialog open={aberto} onOpenChange={o=>{if(!enviando){setAberto(o);if(!o)limpar()}}}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
     <DialogHeader>
      <DialogTitle>Nova peça no quadro</DialogTitle>
      <DialogDescription>
       Para arte ou vídeo que não veio do ClickUp nem do WhatsApp. Ela entra no quadro como qualquer outra.
      </DialogDescription>
     </DialogHeader>

     <div className="space-y-4">
      <div>
       <label htmlFor="np-cliente" className="text-sm font-semibold">Cliente</label>
       <Input id="np-cliente" list="np-clientes" value={client} onChange={e=>setClient(e.target.value)}
         placeholder="Comece a digitar" disabled={enviando} className="mt-1"/>
       <datalist id="np-clientes">
        {clientes.filter(c=>c!=='Identificar cliente').map(c=><option key={c} value={c}/>)}
       </datalist>
      </div>

      <div>
       <label htmlFor="np-titulo" className="text-sm font-semibold">Título da peça</label>
       <Input id="np-titulo" value={title} onChange={e=>setTitle(e.target.value)}
         placeholder="O que é, em poucas palavras" disabled={enviando} className="mt-1"/>
      </div>

      <div>
       <span className="text-sm font-semibold">Onde ela entra</span>
       <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {ETAPAS.map(e=>(
         <button key={e.id} type="button" disabled={enviando} onClick={()=>setStage(e.id)}
           className={`cursor-pointer rounded-lg border p-2 text-left text-sm transition-colors ${stage===e.id?'border-primary bg-primary/10':'hover:border-muted-foreground/40'}`}>
          <span className="font-medium">{e.label}</span>
          <span className="block text-xs text-muted-foreground">{e.ajuda}</span>
         </button>
        ))}
       </div>
      </div>

      <div>
       <span className="text-sm font-semibold">Arquivos</span>
       <button type="button" disabled={enviando} onClick={()=>campo.current?.click()}
         onDragOver={e=>e.preventDefault()}
         onDrop={e=>{e.preventDefault();if(!enviando)somar(e.dataTransfer.files)}}
         className="mt-1 flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:border-primary">
        <Upload className="h-5 w-5"/>
        Arraste aqui ou clique para escolher
        <span className="text-xs">JPG, PNG, WebP ou MP4, até 50 MB cada, no máximo 10</span>
       </button>
       <input ref={campo} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
         className="hidden" onChange={e=>{somar(e.target.files);e.target.value=''}}/>

       {!!arquivos.length&&<ul className="mt-2 space-y-1">
        {arquivos.map((f,i)=>(
         <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm">
          <span className="min-w-0 truncate">{f.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{mb(f.size)}</span>
          {!enviando&&<button type="button" aria-label={`Tirar ${f.name}`}
            onClick={()=>setArquivos(a=>a.filter((_,j)=>j!==i))}
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>}
         </li>
        ))}
       </ul>}
       {arquivos.length>1&&<p className="mt-1 text-xs text-muted-foreground">
        Mais de um arquivo vira carrossel, na ordem acima.
       </p>}
      </div>
     </div>

     <DialogFooter className="gap-2">
      {progresso&&<span className="mr-auto self-center text-sm text-muted-foreground">{progresso}…</span>}
      <Button variant="ghost" disabled={enviando} onClick={()=>{setAberto(false);limpar()}}>Cancelar</Button>
      <Button disabled={!podeEnviar} onClick={()=>void enviar()}>
       {enviando?'Enviando…':'Criar peça'}
      </Button>
     </DialogFooter>
    </DialogContent>
   </Dialog>
  </>
 )
}
