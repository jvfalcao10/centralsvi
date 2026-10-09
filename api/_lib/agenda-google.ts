import {randomUUID} from 'node:crypto'
import {FUSO} from './agenda-domain.js'

const API='https://www.googleapis.com/calendar/v3'
/** A agenda que manda. 'primary' é a principal da conta autorizada. */
const CALENDARIO=process.env.AGENDA_CALENDAR_ID||'primary'

export class AgendaIndisponivel extends Error {}

let cache:{token:string;ate:number}|undefined
async function acesso() {
 if(cache&&cache.ate>Date.now())return cache.token
 // Credencial própria da agenda, separada da do Drive de propósito: trocar uma
 // nunca pode derrubar a outra, e os escopos são diferentes.
 const bruto=process.env.AGENDA_GOOGLE_OAUTH
 if(!bruto)throw new AgendaIndisponivel('agenda_sem_credencial')
 let config:Record<string,string>
 try{config=JSON.parse(bruto)}catch{throw new AgendaIndisponivel('agenda_credencial_invalida')}
 if(!config.refresh_token)throw new AgendaIndisponivel('agenda_sem_refresh_token')
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',
  body:new URLSearchParams({client_id:config.client_id,client_secret:config.client_secret,
   refresh_token:config.refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000)})
 if(!r.ok)throw new AgendaIndisponivel(`agenda_auth_${r.status}`)
 const d=await r.json() as {access_token:string;expires_in:number}
 cache={token:d.access_token,ate:Date.now()+Math.max(60,Number(d.expires_in)-120)*1000}
 return cache.token
}

async function calendario(path:string,init:RequestInit={}) {
 const r=await fetch(API+path,{...init,headers:{Authorization:`Bearer ${await acesso()}`,
  'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(25000)})
 return r
}

/**
 * Os blocos ocupados da agenda, lidos do Google.
 *
 * Usa freeBusy e não a lista de eventos: freeBusy já respeita evento o dia
 * todo, recusado e de outras agendas, que é exatamente o que define se o João
 * pode ou não atender.
 */
export async function ocupados(de:number,ate:number):Promise<{inicio:number;fim:number}[]> {
 const r=await calendario('/freeBusy',{method:'POST',body:JSON.stringify({
  timeMin:new Date(de).toISOString(),timeMax:new Date(ate).toISOString(),
  timeZone:FUSO,items:[{id:CALENDARIO}]})})
 if(!r.ok)throw new AgendaIndisponivel(`agenda_freebusy_${r.status}`)
 const d=await r.json() as {calendars?:Record<string,{busy?:{start:string;end:string}[];errors?:unknown[]}>}
 const agenda=d.calendars?.[CALENDARIO]
 if(!agenda||agenda.errors?.length)throw new AgendaIndisponivel('agenda_calendario_indisponivel')
 return (agenda.busy||[]).map(b=>({inicio:Date.parse(b.start),fim:Date.parse(b.end)}))
  .filter(b=>Number.isFinite(b.inicio)&&Number.isFinite(b.fim))
}

export async function criarEvento(dados:{inicio:number;fim:number;nome:string;email:string;whatsapp:string;assunto:string;cancelarUrl:string}) {
 const corpo={
  summary:`Diagnóstico SVI · ${dados.nome}`,
  description:[`Reunião marcada pela página da SVI.`,'',
   `Nome: ${dados.nome}`,`E-mail: ${dados.email}`,`WhatsApp: ${dados.whatsapp}`,
   dados.assunto?`\nO que a pessoa escreveu:\n${dados.assunto}`:'',
   '',`Cancelar: ${dados.cancelarUrl}`].filter(Boolean).join('\n'),
  start:{dateTime:new Date(dados.inicio).toISOString(),timeZone:FUSO},
  end:{dateTime:new Date(dados.fim).toISOString(),timeZone:FUSO},
  attendees:[{email:dados.email,displayName:dados.nome}],
  // O Meet é criado junto, senão a pessoa recebe convite sem lugar para entrar.
  conferenceData:{createRequest:{requestId:randomUUID(),conferenceSolutionKey:{type:'hangoutsMeet'}}},
  reminders:{useDefault:true},
 }
 const r=await calendario(`/calendars/${encodeURIComponent(CALENDARIO)}/events?conferenceDataVersion=1&sendUpdates=all`,
  {method:'POST',body:JSON.stringify(corpo)})
 if(!r.ok)throw new AgendaIndisponivel(`agenda_evento_${r.status}`)
 const d=await r.json() as {id:string;hangoutLink?:string;conferenceData?:{entryPoints?:{uri?:string;entryPointType?:string}[]}}
 const meet=d.hangoutLink||d.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video')?.uri||''
 return {id:d.id,meet}
}

export async function cancelarEvento(eventId:string) {
 const r=await calendario(`/calendars/${encodeURIComponent(CALENDARIO)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,{method:'DELETE'})
 // 410 é evento já apagado: para quem cancela, o resultado é o mesmo.
 if(!r.ok&&r.status!==404&&r.status!==410)throw new AgendaIndisponivel(`agenda_cancelar_${r.status}`)
}
