import {createHash,randomBytes} from 'node:crypto'
import type {VercelRequest,VercelResponse} from '@vercel/node'
import {createAdminClient} from './supabase.js'
import {AgendaIndisponivel,cancelarEvento,criarEvento,ocupados} from './agenda-google.js'
import {AVISO_MINIMO_MIN,DURACAO_MIN,FUSO,JANELA_DIAS,dadosDaReuniao,emBrasilia,horarioValido,horariosLivres,porDia} from './agenda-domain.js'

const SITE='https://agenda.svicompany.com.br'
const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
const codigo=()=>randomBytes(16).toString('base64url')
const formatoToken=(v:string)=>/^[A-Za-z0-9_-]{20,24}$/.test(v)

const legivel=(t:number)=>{
 const p=emBrasilia(t)
 const SEMANA=['domingo','segunda','terça','quarta','quinta','sexta','sábado']
 return `${SEMANA[p.semana]}, ${String(p.dia).padStart(2,'0')}/${String(p.mes).padStart(2,'0')} às ${String(p.hora).padStart(2,'0')}:${String(p.minuto).padStart(2,'0')}`
}

/** Aviso no WhatsApp. Nunca derruba o agendamento: o convite já foi criado. */
async function whats(numero:string,texto:string) {
 const token=process.env.SOCIAL_UAZ_TOKEN
 if(!token||!numero)return
 try{
  await fetch('https://svicompany.uazapi.com/send/text',{method:'POST',
   headers:{token,'Content-Type':'application/json'},
   body:JSON.stringify({number:numero,text:texto,linkPreview:false,readchat:false,readmessages:false,async:false}),
   signal:AbortSignal.timeout(12000)})
 }catch{/* o convite do Google já foi */}
}

export async function handleAgenda(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','private, no-store')
 res.setHeader('Referrer-Policy','no-referrer')
 if(!['GET','POST'].includes(req.method||''))return res.status(405).json({error:'Método não permitido.'})
 const db=createAdminClient()
 try{
  const token=typeof req.query.r==='string'?req.query.r:typeof req.body?.token==='string'?req.body.token:''

  // Ver uma reunião já marcada, pelo link que a pessoa recebeu.
  if(req.method==='GET'&&token){
   if(!formatoToken(token))return res.status(404).json({error:'Este link não está disponível.'})
   const {data}=await db.from('central_agenda_reunioes').select('nome,inicio,fim,status,meet_url').eq('token_hash',hash(token)).maybeSingle()
   if(!data)return res.status(404).json({error:'Este link não está disponível.'})
   return res.json({reuniao:{nome:data.nome,inicio:data.inicio,quando:legivel(Date.parse(data.inicio)),
    status:data.status,meet:data.meet_url||''}})
  }

  if(req.method==='GET'){
   const agora=Date.now()
   const ate=agora+(JANELA_DIAS+1)*86400000
   const [daAgenda,{data:marcadas}]=await Promise.all([
    ocupados(agora,ate),
    db.from('central_agenda_reunioes').select('inicio,fim').eq('status','confirmada').gte('inicio',new Date(agora).toISOString()),
   ])
   // O banco entra junto porque entre criar a reserva e o Google responder
   // existe uma janela em que o horário já é de alguém e o freeBusy ainda não
   // sabe disso.
   const todos=[...daAgenda,...(marcadas||[]).map(m=>({inicio:Date.parse(m.inicio),fim:Date.parse(m.fim)}))]
   const livres=horariosLivres({agora,ocupados:todos})
   return res.json({dias:porDia(livres),duracao:DURACAO_MIN,fuso:FUSO,aviso_minimo_min:AVISO_MINIMO_MIN})
  }

  if(req.body?.acao==='cancelar'){
   if(!formatoToken(token))return res.status(404).json({error:'Este link não está disponível.'})
   const {data:reuniao}=await db.rpc('central_agenda_cancelar',{p_token_hash:hash(token),p_por:'quem marcou'})
   if(!reuniao)return res.status(409).json({error:'Esta reunião já estava cancelada.'})
   if(reuniao.google_event_id)try{await cancelarEvento(reuniao.google_event_id)}catch{/* a reserva já caiu */}
   await whats(reuniao.whatsapp,`Sua reunião de ${legivel(Date.parse(reuniao.inicio))} foi cancelada. Se quiser remarcar, é só abrir ${SITE}`)
   if(process.env.AGENDA_AVISO_WHATSAPP)
    await whats(process.env.AGENDA_AVISO_WHATSAPP,`Reunião CANCELADA\n${reuniao.nome}\n${legivel(Date.parse(reuniao.inicio))}`)
   return res.json({ok:true,cancelada:true})
  }

  // Marcar.
  const dados=dadosDaReuniao(req.body||{})
  if('erro' in dados)return res.status(400).json({error:dados.erro})
  const agora=Date.now()
  const daAgenda=await ocupados(agora,agora+(JANELA_DIAS+1)*86400000)
  const {data:marcadas}=await db.from('central_agenda_reunioes').select('inicio,fim').eq('status','confirmada').gte('inicio',new Date(agora).toISOString())
  const livres=horariosLivres({agora,ocupados:[...daAgenda,...(marcadas||[]).map(m=>({inicio:Date.parse(m.inicio),fim:Date.parse(m.fim)}))]})
  const inicio=horarioValido(String(req.body?.inicio||''),livres)
  if(!inicio)return res.status(409).json({error:'Esse horário não está mais livre. Escolha outro, por favor.'})

  // Página pública precisa de freio. Sem isto, uma pessoa marca a semana toda.
  const desde=new Date(agora-24*3600000).toISOString()
  const {count}=await db.from('central_agenda_reunioes').select('id',{count:'exact',head:true})
   .eq('status','confirmada').gte('criado_em',desde).or(`email.eq.${dados.email},whatsapp.eq.${dados.whatsapp}`)
  if((count||0)>=3)return res.status(429).json({error:'Você já tem reuniões marcadas. Chame no WhatsApp para remarcar.'})

  const fim=inicio+DURACAO_MIN*60000
  const bruto=codigo()
  // A reserva entra ANTES de falar com o Google: é o índice único do banco que
  // impede duas pessoas de pegarem o mesmo horário no mesmo segundo.
  const {data:reuniao}=await db.rpc('central_agenda_marcar',{
   p_token_hash:hash(bruto),p_nome:dados.nome,p_email:dados.email,p_whatsapp:dados.whatsapp,
   p_assunto:dados.assunto,p_inicio:new Date(inicio).toISOString(),p_fim:new Date(fim).toISOString()})
  if(!reuniao)return res.status(409).json({error:'Esse horário acabou de ser marcado por outra pessoa. Escolha outro.'})

  const cancelarUrl=`${SITE}/r/${bruto}`
  let meet=''
  try{
   const evento=await criarEvento({inicio,fim,...dados,cancelarUrl})
   meet=evento.meet
   await db.rpc('central_agenda_anotar_evento',{p_id:reuniao.id,p_event_id:evento.id,p_meet_url:meet})
  }catch(e){
   // Sem evento no Google a reunião não existe de verdade: devolve o horário.
   await db.rpc('central_agenda_cancelar',{p_token_hash:hash(bruto),p_por:'falha ao criar o evento'})
   throw e
  }

  const quando=legivel(inicio)
  await whats(dados.whatsapp,`Reunião confirmada para ${quando}, horário de Brasília.\n\nO convite foi para ${dados.email}${meet?`\nLink da chamada: ${meet}`:''}\n\nPrecisando desmarcar: ${cancelarUrl}`)
  if(process.env.AGENDA_AVISO_WHATSAPP)
   await whats(process.env.AGENDA_AVISO_WHATSAPP,`Reunião NOVA\n${dados.nome}\n${quando}\n${dados.whatsapp}\n${dados.email}${dados.assunto?`\n\n${dados.assunto}`:''}`)

  return res.json({ok:true,reuniao:{inicio:new Date(inicio).toISOString(),quando,meet,cancelar_url:cancelarUrl,email:dados.email}})
 }catch(e){
  if(e instanceof AgendaIndisponivel){
   console.error('Agenda indisponível',e.message)
   return res.status(503).json({error:'A agenda está indisponível neste momento. Chame no WhatsApp e a SVI marca com você.'})
  }
  console.error('Agenda falhou',e instanceof Error?e.message:'erro')
  return res.status(500).json({error:'Não foi possível concluir. Tente novamente.'})
 }
}
