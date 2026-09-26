import {useEffect,useState} from 'react'
import ApprovalLink from './ApprovalLink'
import {socialApi} from '@/lib/social-board'
export default function ClientApprovalLink({client,pendingCount,disabledReason}:{client:string;pendingCount:number;disabledReason?:string}) {
 const [url,setUrl]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;setUrl('');setError('');if(!client||client==='Identificar cliente')return;setLoading(true);void socialApi('?bundle_link=1&client='+encodeURIComponent(client)).then(d=>{if(active)setUrl(d.approval_url||'')}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[client])
 if(!client||client==='Identificar cliente')return <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold text-sm">Um link com todas as pendências</h2><p className="text-xs text-muted-foreground mt-1">Selecione um cliente no filtro acima para reunir as peças em Aguardando cliente.</p></section>
 return <div><p className="text-sm font-medium mt-4">{client} · {pendingCount} {pendingCount===1?'peça em Aguardando cliente':'peças em Aguardando cliente'}</p><ApprovalLink key={client} bundle url={url} legacy={false} routingPending={false} disabledReason={disabledReason|| (loading?'Carregando link…':!url&&!pendingCount?'Coloque as peças conferidas em Aguardando cliente para gerar o link.':undefined)} onGenerate={async()=>{const d=await socialApi('',{action:'client_link',client});if(!d.approval_url)throw new Error('Não foi possível gerar o link.');setUrl(d.approval_url);setError('');return d.approval_url}}/>{error&&<p role="alert" className="text-sm text-destructive mt-2">{error}</p>}</div>
}
