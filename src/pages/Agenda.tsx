import {useEffect,useMemo,useState} from 'react'
import {useParams} from 'react-router-dom'

type Horario={inicio:string;hora:string}
type Dia={dia:string;rotulo:string;horarios:Horario[]}
type Resposta={dias:Dia[];duracao:number}

const api=async (init?:RequestInit)=>{
 const r=await fetch('/api/agenda',{headers:{'Content-Type':'application/json'},...init})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw new Error(d?.error||'Não foi possível concluir. Tente novamente.')
 return d
}

const Moldura=({children}:{children:React.ReactNode})=>(
 <div className="min-h-screen bg-[#0a0608] text-[#fbf7ec] px-4 py-10 sm:py-16">
  <div className="mx-auto w-full max-w-3xl">
   <header className="mb-8 flex items-center gap-3">
    <span className="text-[#d9b872] text-2xl font-semibold tracking-tight">SVI</span>
    <span className="h-5 w-px bg-[#fbf7ec]/20"/>
    <span className="text-sm text-[#fbf7ec]/60">Agendamento</span>
   </header>
   {children}
   <footer className="mt-12 text-xs text-[#fbf7ec]/40">Horários de Brasília.</footer>
  </div>
 </div>
)

const Aviso=({texto}:{texto:string})=>(
 <p role="alert" className="rounded-lg border border-[#d9b872]/40 bg-[#d9b872]/10 px-4 py-3 text-sm text-[#fbf7ec]">{texto}</p>
)

export default function Agenda(){
 const [dados,setDados]=useState<Resposta|null>(null)
 const [erro,setErro]=useState('')
 const [escolhido,setEscolhido]=useState<Horario|null>(null)
 const [enviando,setEnviando]=useState(false)
 const [pronto,setPronto]=useState<{quando:string;meet:string;email:string;cancelar_url:string}|null>(null)
 const [form,setForm]=useState({nome:'',email:'',whatsapp:'',assunto:''})

 useEffect(()=>{
  let vivo=true
  api().then(d=>{if(vivo)setDados(d)}).catch(e=>{if(vivo)setErro(e.message)})
  return ()=>{vivo=false}
 },[])

 const diasComHorario=useMemo(()=>(dados?.dias||[]).filter(d=>d.horarios.length),[dados])

 if(pronto)return (
  <Moldura>
   <h1 className="text-2xl sm:text-3xl font-semibold mb-3">Reunião confirmada</h1>
   <p className="text-[#fbf7ec]/80 mb-6">{pronto.quando}, horário de Brasília. O convite foi para {pronto.email}.</p>
   {pronto.meet&&<a href={pronto.meet} target="_blank" rel="noreferrer"
     className="inline-flex min-h-11 items-center rounded-lg bg-[#d9b872] px-5 font-medium text-[#0a0608]">Entrar na chamada</a>}
   <p className="mt-6 text-sm text-[#fbf7ec]/60">Precisando desmarcar, use este endereço: <a className="underline" href={pronto.cancelar_url}>{pronto.cancelar_url}</a></p>
  </Moldura>
 )

 return (
  <Moldura>
   <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Vamos conversar sobre o seu marketing</h1>
   <p className="text-[#fbf7ec]/70 mb-8">{dados?`Uma conversa de ${dados.duracao} minutos, por chamada de vídeo. Escolha o horário que te serve.`:'Carregando os horários livres.'}</p>

   {erro&&<div className="mb-6"><Aviso texto={erro}/></div>}

   {!escolhido&&diasComHorario.map(d=>(
    <section key={d.dia} className="mb-6">
     <h2 className="mb-3 text-sm uppercase tracking-wide text-[#fbf7ec]/50">{d.rotulo}</h2>
     <div className="flex flex-wrap gap-2">
      {d.horarios.map(h=>(
       <button key={h.inicio} onClick={()=>{setEscolhido(h);setErro('')}}
         className="min-h-11 rounded-lg border border-[#fbf7ec]/20 px-4 text-sm hover:border-[#d9b872] hover:text-[#d9b872]">{h.hora}</button>
      ))}
     </div>
    </section>
   ))}

   {!escolhido&&dados&&!diasComHorario.length&&
    <Aviso texto="Não há horário livre nas próximas semanas. Chame no WhatsApp que a SVI encaixa você."/>}

   {escolhido&&(
    <form className="space-y-4" onSubmit={async e=>{
      e.preventDefault();setEnviando(true);setErro('')
      try{
       const d=await api({method:'POST',body:JSON.stringify({inicio:escolhido.inicio,...form})})
       setPronto(d.reuniao)
      }catch(err){
       setErro((err as Error).message)
       // Horário tomado por outra pessoa: volta para a lista já atualizada.
       if(/livre|marcado/i.test((err as Error).message)){
        setEscolhido(null)
        api().then(setDados).catch(()=>{})
       }
      }finally{setEnviando(false)}
    }}>
     <div className="rounded-lg border border-[#d9b872]/40 bg-[#d9b872]/10 px-4 py-3 text-sm">
      Horário escolhido: <strong>{escolhido.hora}</strong>{' '}
      <button type="button" className="underline text-[#d9b872]" onClick={()=>setEscolhido(null)}>trocar</button>
     </div>
     {([['nome','Seu nome completo','text'],['email','Seu melhor e-mail','email'],['whatsapp','WhatsApp com DDD','tel']] as const).map(([campo,rotulo,tipo])=>(
      <label key={campo} className="block">
       <span className="mb-1 block text-sm text-[#fbf7ec]/70">{rotulo}</span>
       <input required type={tipo} value={form[campo]} onChange={e=>setForm(f=>({...f,[campo]:e.target.value}))}
         className="h-12 w-full rounded-lg border border-[#fbf7ec]/20 bg-transparent px-4 text-base outline-none focus:border-[#d9b872]"/>
      </label>
     ))}
     <label className="block">
      <span className="mb-1 block text-sm text-[#fbf7ec]/70">O que você quer resolver (opcional)</span>
      <textarea value={form.assunto} maxLength={600} onChange={e=>setForm(f=>({...f,assunto:e.target.value}))}
        className="min-h-24 w-full rounded-lg border border-[#fbf7ec]/20 bg-transparent p-4 text-base outline-none focus:border-[#d9b872]"/>
     </label>
     <button disabled={enviando} type="submit"
       className="min-h-12 w-full rounded-lg bg-[#d9b872] px-6 font-medium text-[#0a0608] disabled:opacity-60 sm:w-auto">
      {enviando?'Confirmando…':'Confirmar reunião'}
     </button>
    </form>
   )}
  </Moldura>
 )
}

/** A tela do link que a pessoa recebe: ver e desmarcar. */
export function AgendaReuniao(){
 const {token=''}=useParams()
 const [r,setR]=useState<{nome:string;quando:string;status:string;meet:string}|null>(null)
 const [erro,setErro]=useState('')
 const [ocupado,setOcupado]=useState(false)
 useEffect(()=>{
  fetch(`/api/agenda?r=${encodeURIComponent(token)}`).then(async res=>{
   const d=await res.json().catch(()=>({}))
   if(!res.ok)throw new Error(d?.error||'Este link não está disponível.')
   setR(d.reuniao)
  }).catch(e=>setErro(e.message))
 },[token])

 if(erro)return <Moldura><Aviso texto={erro}/></Moldura>
 if(!r)return <Moldura><p className="text-[#fbf7ec]/60">Carregando.</p></Moldura>
 const cancelada=r.status==='cancelada'
 return (
  <Moldura>
   <h1 className="text-2xl sm:text-3xl font-semibold mb-2">{cancelada?'Reunião cancelada':'Sua reunião'}</h1>
   <p className="text-[#fbf7ec]/80 mb-6">{r.nome}, {r.quando}.</p>
   {!cancelada&&r.meet&&<a href={r.meet} target="_blank" rel="noreferrer"
     className="mb-6 inline-flex min-h-11 items-center rounded-lg bg-[#d9b872] px-5 font-medium text-[#0a0608]">Entrar na chamada</a>}
   {cancelada
    ?<a className="underline text-[#d9b872]" href="/">Marcar outro horário</a>
    :<button disabled={ocupado} onClick={async()=>{
       setOcupado(true);setErro('')
       try{
        const res=await fetch('/api/agenda',{method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({acao:'cancelar',token})})
        const d=await res.json().catch(()=>({}))
        if(!res.ok)throw new Error(d?.error||'Não foi possível cancelar.')
        setR(a=>a?{...a,status:'cancelada'}:a)
       }catch(e){setErro((e as Error).message)}finally{setOcupado(false)}
      }}
      className="block min-h-11 rounded-lg border border-[#fbf7ec]/25 px-5 text-sm text-[#fbf7ec]/80 disabled:opacity-60">
      {ocupado?'Cancelando…':'Preciso desmarcar'}
     </button>}
  </Moldura>
 )
}
