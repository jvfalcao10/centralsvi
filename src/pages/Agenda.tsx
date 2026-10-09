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
 *
 * O acabamento segue as duas referências que o João escolheu: formas
 * geométricas flutuando ao fundo e painéis de vidro. Feito em CSS puro, sem
 * biblioteca de animação, para não pesar uma página que abre no celular do
 * prospect, e desligado por inteiro em prefers-reduced-motion.
 */
const OURO='#D0B870',OURO_CLARO='#E8D49A',OURO_FUNDO='#A8863F'
const PRETO='#15100A',CREME='#F6F1E6'
const SORA="'Sora',system-ui,sans-serif"

const CSS=`
@keyframes sviFlutua{0%,100%{transform:translateY(0) rotate(var(--giro,0deg))}50%{transform:translateY(18px) rotate(var(--giro,0deg))}}
@keyframes sviEntra{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes sviChega{from{opacity:0;transform:translateY(-120px) rotate(calc(var(--giro,0deg) - 15deg))}
 to{opacity:1;transform:translateY(0) rotate(var(--giro,0deg))}}
.sviForma{animation:sviChega 2.1s cubic-bezier(.23,.86,.39,.96) both,sviFlutua 13s ease-in-out infinite 2.1s}
.sviEntra{animation:sviEntra .7s cubic-bezier(.25,.4,.25,1) both}
.sviVidro{backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%)}
.sviHora:hover{border-color:${OURO};color:${OURO};background:${OURO}14}
.sviCampo:focus{border-color:${OURO};box-shadow:0 0 0 3px ${OURO}26}
@media (prefers-reduced-motion:reduce){.sviForma,.sviEntra{animation:none!important}}
`

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
  l.href='https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Poppins:wght@400;500;600&display=swap'
  document.head.appendChild(l)
 },[])
}

/** Pílula dourada desfocada do fundo. Decorativa, fora da árvore de leitura. */
const Forma=({largura,altura,giro,atraso,...pos}:{largura:number;altura:number;giro:number;atraso:number;
 top?:string;left?:string;right?:string;bottom?:string})=>(
 <div className="sviForma absolute" aria-hidden
   style={{...pos,width:largura,height:altura,['--giro' as string]:`${giro}deg`,animationDelay:`${atraso}s, ${atraso+2.1}s`}}>
  <div className="h-full w-full rounded-full"
    style={{background:`linear-gradient(90deg, ${OURO}26, transparent)`,
     border:`1px solid ${OURO}1f`,backdropFilter:'blur(2px)',
     boxShadow:`0 8px 32px 0 ${OURO}14, inset 0 1px 0 ${CREME}1a`}}/>
 </div>
)

const Fundo=()=>(
 <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
  <div className="absolute inset-0" style={{background:`radial-gradient(70rem 36rem at 50% -15%, ${OURO}1a, transparent 68%)`}}/>
  <Forma largura={560} altura={130} giro={12} atraso={0.2} left="-14%" top="12%"/>
  <Forma largura={440} altura={110} giro={-15} atraso={0.45} right="-10%" top="62%"/>
  <Forma largura={280} altura={76} giro={-8} atraso={0.65} left="4%" bottom="8%"/>
  <Forma largura={200} altura={58} giro={20} atraso={0.8} right="12%" top="12%"/>
  {/* Escurece o pé para o texto nunca brigar com as formas. */}
  <div className="absolute inset-0" style={{background:`linear-gradient(to bottom, ${PRETO}00 55%, ${PRETO}cc)`}}/>
 </div>
)

const Moldura=({children}:{children:React.ReactNode})=>{
 useFontesDaCasa()
 return (
  <div className="relative min-h-screen antialiased" style={{background:PRETO,color:CREME,fontFamily:"'Poppins',system-ui,sans-serif"}}>
   <style>{CSS}</style>
   <Fundo/>
   <div className="relative mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-14">
    <header className="sviEntra mb-10 flex items-center justify-between gap-4">
     <img src={logoSVI} alt="SVI Company, assessoria de marketing" className="h-11 w-auto sm:h-14"/>
     <span className="text-[11px] uppercase tracking-[0.22em]" style={{color:`${CREME}73`}}>Agendamento</span>
    </header>
    {children}
    <footer className="mt-14 border-t pt-5 text-xs" style={{borderColor:`${CREME}1a`,color:`${CREME}66`}}>
     Todos os horários em Brasília.
    </footer>
   </div>
  </div>
 )
}

const Titulo=({children}:{children:React.ReactNode})=>(
 <h1 className="sviEntra font-extrabold leading-[1.05] tracking-tight text-[2.1rem] sm:text-[3rem]"
   style={{fontFamily:SORA,animationDelay:'.1s'}}>{children}</h1>
)

const Ouro=({children}:{children:React.ReactNode})=>(
 <span style={{background:`linear-gradient(100deg, ${OURO_CLARO}, ${OURO} 45%, ${OURO_FUNDO})`,
   WebkitBackgroundClip:'text',backgroundClip:'text',color:'transparent'}}>{children}</span>
)

const Vidro=({children,className='',atraso=0.25}:{children:React.ReactNode;className?:string;atraso?:number})=>(
 <section className={`sviVidro sviEntra rounded-2xl p-5 sm:p-7 ${className}`}
   style={{background:`${CREME}0a`,border:`1px solid ${OURO}2e`,
    boxShadow:`0 18px 50px -20px #000000b3, inset 0 1px 0 ${CREME}1f`,animationDelay:`${atraso}s`}}>{children}</section>
)

const Recado=({titulo,texto,children}:{titulo:string;texto:string;children?:React.ReactNode})=>(
 <Vidro><div className="flex gap-4">
  <span aria-hidden className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{background:OURO}}/>
  <div>
   <p className="font-semibold" style={{fontFamily:SORA}}>{titulo}</p>
   <p className="mt-1 text-sm" style={{color:`${CREME}b3`}}>{texto}</p>
   {children&&<div className="mt-4">{children}</div>}
  </div>
 </div></Vidro>
)

const Passos=({atual}:{atual:1|2|3})=>(
 <ol className="sviEntra mb-7 flex items-center gap-2 text-xs sm:text-sm" aria-label="Etapas">
  {(['Escolha o horário','Seus dados','Confirmado'] as const).map((rotulo,i)=>{
   const n=(i+1) as 1|2|3,feito=n<atual,aqui=n===atual
   return (
    <li key={rotulo} className="flex items-center gap-2" aria-current={aqui?'step':undefined}>
     <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
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
 fontFamily:SORA,boxShadow:`0 10px 30px -10px ${OURO}73`} as React.CSSProperties
const ZAP='https://wa.me/5594992416107'

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
   <Titulo><Ouro>Reunião confirmada</Ouro></Titulo>
   <p className="sviEntra mt-3 text-lg" style={{color:`${CREME}cc`,animationDelay:'.18s'}}>{pronto.quando}</p>
   <Vidro className="mt-8">
    <p className="text-sm" style={{color:`${CREME}b3`}}>O convite foi para <strong style={{color:CREME}}>{pronto.email}</strong>, com o link da chamada.</p>
    {pronto.meet&&<a href={pronto.meet} target="_blank" rel="noreferrer"
      className={`${botaoOuro} mt-5 w-full sm:w-auto`} style={estiloOuro}>Entrar na chamada</a>}
    <p className="mt-6 text-xs" style={{color:`${CREME}73`}}>
     Precisando desmarcar: <a className="underline underline-offset-2" style={{color:OURO}} href={pronto.cancelar_url}>use este link</a>
    </p>
   </Vidro>
  </Moldura>
 )

 return (
  <Moldura>
   <Passos atual={escolhido?2:1}/>
   <Titulo>Vamos conversar<br/><Ouro>sobre o seu marketing</Ouro></Titulo>
   <p className="sviEntra mt-4 max-w-xl text-base sm:text-lg" style={{color:`${CREME}b3`,animationDelay:'.18s'}}>
    {dados?`${dados.duracao} minutos por chamada de vídeo. A conversa começa pelos seus números, não por apresentação pronta.`
          :'Trinta minutos por chamada de vídeo. A conversa começa pelos seus números.'}
   </p>

   <div className="mt-9 space-y-5">
    {erro&&<Recado titulo="A agenda não abriu agora" texto={erro}>
     <a href={ZAP} target="_blank" rel="noreferrer" className={`${botaoOuro} w-full sm:w-auto`} style={estiloOuro}>Falar no WhatsApp</a>
    </Recado>}

    {!dados&&!erro&&(
     <Vidro><div className="animate-pulse space-y-3 motion-reduce:animate-none">
      <div className="h-4 w-40 rounded" style={{background:`${CREME}1a`}}/>
      <div className="flex flex-wrap gap-2">
       {Array.from({length:8}).map((_,i)=><div key={i} className="h-11 w-20 rounded-xl" style={{background:`${CREME}14`}}/>)}
      </div>
     </div></Vidro>
    )}

    {dados&&!dias.length&&!erro&&
     <Recado titulo="Sem horário livre nas próximas semanas" texto="Chame no WhatsApp que a SVI encaixa você.">
      <a href={ZAP} target="_blank" rel="noreferrer" className={`${botaoOuro} w-full sm:w-auto`} style={estiloOuro}>Falar no WhatsApp</a>
     </Recado>}

    {!escolhido&&!!dias.length&&(
     <Vidro>
      <p className="mb-4 text-sm font-medium" style={{color:`${CREME}99`}}>Escolha o dia</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Dias disponíveis">
       {dias.map(d=>{
        const ativo=d.dia===diaAberto
        return (
         <button key={d.dia} role="tab" aria-selected={ativo} onClick={()=>setDiaAberto(d.dia)}
           className="min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
           style={ativo?{background:OURO,color:PRETO,fontWeight:600,boxShadow:`0 8px 24px -10px ${OURO}99`}
                       :{border:`1px solid ${CREME}26`,color:`${CREME}b3`}}>
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
          className="sviHora min-h-12 cursor-pointer rounded-xl text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{border:`1px solid ${CREME}26`,color:CREME}}>{h.hora}</button>
       ))}
      </div>
     </Vidro>
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
      <Vidro className="!p-4" atraso={0}>
       <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
         <span style={{color:`${CREME}99`}}>Horário escolhido:</span>{' '}
         <strong style={{color:OURO,fontFamily:SORA}}>{escolhido.hora}</strong>
        </p>
        <button type="button" onClick={()=>setEscolhido(null)}
          className="min-h-9 cursor-pointer rounded-lg px-3 text-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
          style={{color:`${CREME}b3`}}>trocar horário</button>
       </div>
      </Vidro>

      <Vidro className="space-y-4" atraso={0.08}>
       {([['nome','Seu nome completo','text','name'],
          ['email','Seu melhor e-mail','email','email'],
          ['whatsapp','WhatsApp com DDD','tel','tel']] as const).map(([campo,rotulo,tipo,auto])=>(
        <label key={campo} className="block">
         <span className="mb-1.5 block text-sm" style={{color:`${CREME}99`}}>{rotulo}</span>
         <input required type={tipo} autoComplete={auto} value={form[campo]}
           onChange={e=>setForm(f=>({...f,[campo]:e.target.value}))}
           className="sviCampo h-12 w-full rounded-xl px-4 text-base outline-none transition-colors duration-200 motion-reduce:transition-none"
           style={{background:`${CREME}0a`,border:`1px solid ${CREME}26`,color:CREME}}/>
        </label>
       ))}
       <label className="block">
        <span className="mb-1.5 block text-sm" style={{color:`${CREME}99`}}>O que você quer resolver <span style={{color:`${CREME}66`}}>(opcional)</span></span>
        <textarea value={form.assunto} maxLength={600} rows={3}
          onChange={e=>setForm(f=>({...f,assunto:e.target.value}))}
          className="sviCampo w-full rounded-xl p-4 text-base outline-none transition-colors duration-200 motion-reduce:transition-none"
          style={{background:`${CREME}0a`,border:`1px solid ${CREME}26`,color:CREME}}/>
       </label>
       <button disabled={enviando} type="submit" className={`${botaoOuro} w-full`} style={estiloOuro}>
        {enviando?'Confirmando…':'Confirmar reunião'}
       </button>
       <p className="text-center text-xs" style={{color:`${CREME}66`}}>Você recebe o convite por e-mail e a confirmação no WhatsApp.</p>
      </Vidro>
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

 if(erro&&!r)return <Moldura><Recado titulo="Link indisponível" texto={erro}/></Moldura>
 if(!r)return <Moldura><Vidro><div className="h-5 w-48 animate-pulse rounded motion-reduce:animate-none" style={{background:`${CREME}1a`}}/></Vidro></Moldura>
 const cancelada=r.status==='cancelada'
 return (
  <Moldura>
   <Titulo>{cancelada?<Ouro>Reunião cancelada</Ouro>:'Sua reunião'}</Titulo>
   <p className="sviEntra mt-3 text-lg" style={{color:`${CREME}cc`,animationDelay:'.18s'}}>{r.nome}, {r.quando}.</p>
   <Vidro className="mt-8 space-y-5">
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
   </Vidro>
  </Moldura>
 )
}
