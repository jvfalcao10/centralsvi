import {useEffect,useMemo,useState} from 'react'
import {useParams} from 'react-router-dom'
import logoSVI from '@/assets/logo-branca.png'

type Horario={inicio:string;hora:string}
type Dia={dia:string;rotulo:string;horarios:Horario[]}
type Resposta={dias:Dia[];duracao:number}

/**
 * Identidade da casa, não a do app interno.
 *
 * Esta página fala com prospect, então segue a matriz SVI: dourado #D0B870
 * sobre preto quente #15100A, Sora nos títulos e Poppins no corpo. Nunca Inter,
 * nunca verde, que é da sub-marca de agentes.
 */
const OURO='#D0B870',OURO_CLARO='#E8D49A',OURO_FUNDO='#A8863F'
const PRETO='#15100A',CREME='#F6F1E6'

const api=async (init?:RequestInit)=>{
 const r=await fetch('/api/agenda',{headers:{'Content-Type':'application/json'},...init})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw new Error(d?.error||'Não foi possível concluir. Tente novamente.')
 return d
}

/** Carrega as fontes só nesta página, para não pesar a Central inteira. */
function useFontesDaCasa(){
 useEffect(()=>{
  const id='fontes-svi-agenda'
  if(document.getElementById(id))return
  const l=document.createElement('link');l.id=id;l.rel='stylesheet'
  l.href='https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Poppins:wght@400;500;600&display=swap'
  document.head.appendChild(l)
 },[])
}

const Moldura=({children,largo=false}:{children:React.ReactNode;largo?:boolean})=>{
 useFontesDaCasa()
 return (
  <div className="min-h-screen antialiased" style={{background:PRETO,color:CREME,fontFamily:"'Poppins',system-ui,sans-serif"}}>
   {/* Brilho dourado de fundo, discreto. Decorativo, fora da árvore de leitura. */}
   <div aria-hidden className="pointer-events-none fixed inset-0"
     style={{background:`radial-gradient(60rem 30rem at 50% -10%, ${OURO}1f, transparent 70%)`}}/>
   <div className={`relative mx-auto w-full px-5 py-8 sm:px-8 sm:py-14 ${largo?'max-w-5xl':'max-w-2xl'}`}>
    <header className="mb-10 flex items-center justify-between gap-4">
     <img src={logoSVI} alt="SVI Company, assessoria de marketing" className="h-9 w-auto sm:h-11"/>
     <span className="text-xs tracking-[0.2em] uppercase" style={{color:`${CREME}80`}}>Agendamento</span>
    </header>
    {children}
    <footer className="mt-14 border-t pt-5 text-xs" style={{borderColor:`${CREME}1a`,color:`${CREME}66`}}>
     Todos os horários em Brasília.
    </footer>
   </div>
  </div>
 )
}

const Titulo=({children,className=''}:{children:React.ReactNode;className?:string})=>(
 <h1 className={`font-bold leading-[1.1] tracking-tight text-[2rem] sm:text-[2.75rem] ${className}`}
   style={{fontFamily:"'Sora',system-ui,sans-serif"}}>{children}</h1>
)

const Painel=({children,className=''}:{children:React.ReactNode;className?:string})=>(
 <section className={`rounded-2xl border p-5 sm:p-7 ${className}`}
   style={{borderColor:`${CREME}1f`,background:`${CREME}08`}}>{children}</section>
)

const Recado=({titulo,texto,children}:{titulo:string;texto:string;children?:React.ReactNode})=>(
 <Painel><div className="flex gap-4">
  <span aria-hidden className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{background:OURO}}/>
  <div>
   <p className="font-semibold" style={{fontFamily:"'Sora',sans-serif"}}>{titulo}</p>
   <p className="mt-1 text-sm" style={{color:`${CREME}b3`}}>{texto}</p>
   {children&&<div className="mt-4">{children}</div>}
  </div>
 </div></Painel>
)

const Passos=({atual}:{atual:1|2|3})=>(
 <ol className="mb-8 flex items-center gap-2 text-xs sm:text-sm" aria-label="Etapas">
  {(['Escolha o horário','Seus dados','Confirmado'] as const).map((rotulo,i)=>{
   const n=(i+1) as 1|2|3,feito=n<atual,aqui=n===atual
   return (
    <li key={rotulo} className="flex items-center gap-2" aria-current={aqui?'step':undefined}>
     <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold transition-colors"
       style={feito||aqui?{background:OURO,color:PRETO}:{border:`1px solid ${CREME}33`,color:`${CREME}66`}}>{n}</span>
     <span className="hidden sm:inline" style={{color:aqui?CREME:`${CREME}73`}}>{rotulo}</span>
     {n<3&&<span aria-hidden className="mx-1 h-px w-4 sm:w-8" style={{background:`${CREME}26`}}/>}
    </li>
   )
  })}
 </ol>
)

const botaoOuro='inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-6 font-semibold transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:scale-100'
const estiloOuro={background:`linear-gradient(135deg, ${OURO_CLARO}, ${OURO} 55%, ${OURO_FUNDO})`,color:PRETO,
 fontFamily:"'Sora',sans-serif"} as React.CSSProperties

export default function Agenda(){
 const [dados,setDados]=useState<Resposta|null>(null)
 const [erro,setErro]=useState('')
 const [diaAberto,setDiaAberto]=useState<string|null>(null)
 const [escolhido,setEscolhido]=useState<Horario|null>(null)
 const [enviando,setEnviando]=useState(false)
 const [pronto,setPronto]=useState<{quando:string;meet:string;email:string;cancelar_url:string}|null>(null)
 const [form,setForm]=useState({nome:'',email:'',whatsapp:'',assunto:''})

 useEffect(()=>{
  let vivo=true
  api().then(d=>{if(!vivo)return;setDados(d)
   setDiaAberto(d.dias.find((x:Dia)=>x.horarios.length)?.dia??null)
  }).catch(e=>{if(vivo)setErro(e.message)})
  return ()=>{vivo=false}
 },[])

 const dias=useMemo(()=>(dados?.dias||[]).filter(d=>d.horarios.length),[dados])
 const doDia=useMemo(()=>dias.find(d=>d.dia===diaAberto)?.horarios||[],[dias,diaAberto])

 if(pronto)return (
  <Moldura>
   <Passos atual={3}/>
   <Titulo>Reunião confirmada</Titulo>
   <p className="mt-3 text-lg" style={{color:`${CREME}cc`}}>{pronto.quando}</p>
   <Painel className="mt-8">
    <p className="text-sm" style={{color:`${CREME}b3`}}>O convite foi para <strong style={{color:CREME}}>{pronto.email}</strong>, com o link da chamada.</p>
    {pronto.meet&&<a href={pronto.meet} target="_blank" rel="noreferrer"
      className={`${botaoOuro} mt-5 w-full sm:w-auto`} style={estiloOuro}>Entrar na chamada</a>}
    <p className="mt-6 text-xs" style={{color:`${CREME}73`}}>
     Precisando desmarcar: <a className="underline underline-offset-2" style={{color:OURO}} href={pronto.cancelar_url}>use este link</a>
    </p>
   </Painel>
  </Moldura>
 )

 return (
  <Moldura>
   <Passos atual={escolhido?2:1}/>
   <Titulo>Vamos conversar<br/>sobre o seu marketing</Titulo>
   <p className="mt-4 max-w-xl text-base sm:text-lg" style={{color:`${CREME}b3`}}>
    {dados?`${dados.duracao} minutos por chamada de vídeo. A conversa começa pelos seus números, não por apresentação pronta.`
          :'Trinta minutos por chamada de vídeo. A conversa começa pelos seus números.'}
   </p>

   <div className="mt-9 space-y-5">
    {erro&&<Recado titulo="A agenda não abriu agora" texto={erro}>
     <a href="https://wa.me/5594992416107" target="_blank" rel="noreferrer"
       className={`${botaoOuro} w-full sm:w-auto`} style={estiloOuro}>Falar no WhatsApp</a>
    </Recado>}

    {!dados&&!erro&&(
     <Painel><div className="animate-pulse space-y-3 motion-reduce:animate-none">
      <div className="h-4 w-40 rounded" style={{background:`${CREME}1a`}}/>
      <div className="flex flex-wrap gap-2">
       {Array.from({length:8}).map((_,i)=><div key={i} className="h-11 w-20 rounded-xl" style={{background:`${CREME}14`}}/>)}
      </div>
     </div></Painel>
    )}

    {dados&&!dias.length&&!erro&&
     <Recado titulo="Sem horário livre nas próximas semanas" texto="Chame no WhatsApp que a SVI encaixa você.">
      <a href="https://wa.me/5594992416107" target="_blank" rel="noreferrer"
        className={`${botaoOuro} w-full sm:w-auto`} style={estiloOuro}>Falar no WhatsApp</a>
     </Recado>}

    {!escolhido&&!!dias.length&&(
     <Painel>
      <p className="mb-4 text-sm font-medium" style={{color:`${CREME}99`}}>Escolha o dia</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Dias disponíveis">
       {dias.map(d=>{
        const ativo=d.dia===diaAberto
        return (
         <button key={d.dia} role="tab" aria-selected={ativo} onClick={()=>setDiaAberto(d.dia)}
           className="min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
           style={ativo?{background:OURO,color:PRETO,fontWeight:600}:{border:`1px solid ${CREME}26`,color:`${CREME}b3`}}>
          {d.rotulo}
          <span className="ml-2 text-xs" style={{color:ativo?`${PRETO}99`:`${CREME}66`}}>{d.horarios.length}</span>
         </button>
        )
       })}
      </div>

      <p className="mb-3 mt-6 text-sm font-medium" style={{color:`${CREME}99`}}>Escolha o horário</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
       {doDia.map(h=>(
        <button key={h.inicio} onClick={()=>{setEscolhido(h);setErro('')}}
          className="min-h-12 cursor-pointer rounded-xl text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{border:`1px solid ${CREME}26`,color:CREME}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=OURO;e.currentTarget.style.color=OURO}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=`${CREME}26`;e.currentTarget.style.color=CREME}}>
         {h.hora}
        </button>
       ))}
      </div>
     </Painel>
    )}

    {escolhido&&(
     <form className="space-y-4" onSubmit={async e=>{
       e.preventDefault();setEnviando(true);setErro('')
       try{
        const d=await api({method:'POST',body:JSON.stringify({inicio:escolhido.inicio,...form})})
        setPronto(d.reuniao)
       }catch(err){
        setErro((err as Error).message)
        if(/livre|marcado/i.test((err as Error).message)){
         setEscolhido(null)
         api().then(setDados).catch(()=>{})
        }
       }finally{setEnviando(false)}
     }}>
      <Painel className="!p-4">
       <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
         <span style={{color:`${CREME}99`}}>Horário escolhido:</span>{' '}
         <strong style={{color:OURO,fontFamily:"'Sora',sans-serif"}}>{escolhido.hora}</strong>
        </p>
        <button type="button" onClick={()=>setEscolhido(null)}
          className="min-h-9 cursor-pointer rounded-lg px-3 text-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
          style={{color:`${CREME}b3`}}>trocar horário</button>
       </div>
      </Painel>

      <Painel className="space-y-4">
       {([['nome','Seu nome completo','text','name'],
          ['email','Seu melhor e-mail','email','email'],
          ['whatsapp','WhatsApp com DDD','tel','tel']] as const).map(([campo,rotulo,tipo,auto])=>(
        <label key={campo} className="block">
         <span className="mb-1.5 block text-sm" style={{color:`${CREME}99`}}>{rotulo}</span>
         <input required type={tipo} autoComplete={auto} value={form[campo]}
           onChange={e=>setForm(f=>({...f,[campo]:e.target.value}))}
           className="h-12 w-full rounded-xl px-4 text-base outline-none transition-colors duration-200 focus:ring-2 motion-reduce:transition-none"
           style={{background:`${CREME}0a`,border:`1px solid ${CREME}26`,color:CREME}}
           onFocus={e=>{e.currentTarget.style.borderColor=OURO}}
           onBlur={e=>{e.currentTarget.style.borderColor=`${CREME}26`}}/>
        </label>
       ))}
       <label className="block">
        <span className="mb-1.5 block text-sm" style={{color:`${CREME}99`}}>O que você quer resolver <span style={{color:`${CREME}66`}}>(opcional)</span></span>
        <textarea value={form.assunto} maxLength={600} rows={3}
          onChange={e=>setForm(f=>({...f,assunto:e.target.value}))}
          className="w-full rounded-xl p-4 text-base outline-none transition-colors duration-200 focus:ring-2 motion-reduce:transition-none"
          style={{background:`${CREME}0a`,border:`1px solid ${CREME}26`,color:CREME}}
          onFocus={e=>{e.currentTarget.style.borderColor=OURO}}
          onBlur={e=>{e.currentTarget.style.borderColor=`${CREME}26`}}/>
       </label>
       <button disabled={enviando} type="submit" className={`${botaoOuro} w-full`} style={estiloOuro}>
        {enviando?'Confirmando…':'Confirmar reunião'}
       </button>
       <p className="text-center text-xs" style={{color:`${CREME}66`}}>Você recebe o convite por e-mail e a confirmação no WhatsApp.</p>
      </Painel>
     </form>
    )}
   </div>
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

 if(erro)return <Moldura><Recado titulo="Link indisponível" texto={erro}/></Moldura>
 if(!r)return <Moldura><Painel><div className="h-5 w-48 animate-pulse rounded motion-reduce:animate-none" style={{background:`${CREME}1a`}}/></Painel></Moldura>
 const cancelada=r.status==='cancelada'
 return (
  <Moldura>
   <Titulo>{cancelada?'Reunião cancelada':'Sua reunião'}</Titulo>
   <p className="mt-3 text-lg" style={{color:`${CREME}cc`}}>{r.nome}, {r.quando}.</p>
   <Painel className="mt-8 space-y-5">
    {!cancelada&&r.meet&&<a href={r.meet} target="_blank" rel="noreferrer"
      className={`${botaoOuro} w-full sm:w-auto`} style={estiloOuro}>Entrar na chamada</a>}
    {erro&&<p role="alert" className="text-sm" style={{color:OURO}}>{erro}</p>}
    {cancelada
     ?<a className={`${botaoOuro} w-full sm:w-auto`} style={estiloOuro} href="/">Marcar outro horário</a>
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
       className="min-h-11 w-full cursor-pointer rounded-xl px-5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 sm:w-auto motion-reduce:transition-none"
       style={{border:`1px solid ${CREME}26`,color:`${CREME}b3`}}>
       {ocupado?'Cancelando…':'Preciso desmarcar'}
      </button>}
   </Painel>
  </Moldura>
 )
}
