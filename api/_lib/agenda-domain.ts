export const FUSO='America/Sao_Paulo'
export const DURACAO_MIN=30
export const ABRE_HORA=9
export const FECHA_HORA=18
/** Ninguém marca com dez minutos de antecedência e aparece. */
export const AVISO_MINIMO_MIN=120
export const JANELA_DIAS=21

type Partes={ano:number;mes:number;dia:number;hora:number;minuto:number;semana:number}

const FORMATO=new Intl.DateTimeFormat('en-US',{timeZone:FUSO,hour12:false,weekday:'short',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
const DIAS={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6} as Record<string,number>

/** A hora de Brasília de um instante. */
export function emBrasilia(t:number):Partes {
 const p=Object.fromEntries(FORMATO.formatToParts(new Date(t)).map(x=>[x.type,x.value])) as Record<string,string>
 // 24:00 aparece no lugar de 00:00 em algumas plataformas.
 const hora=Number(p.hour)%24
 return {ano:Number(p.year),mes:Number(p.month),dia:Number(p.day),hora,minuto:Number(p.minute),semana:DIAS[p.weekday]??0}
}

/**
 * O instante UTC de uma hora de parede em Brasília.
 *
 * O Brasil não tem horário de verão desde 2019, então o deslocamento é -3h.
 * Ainda assim o chute é conferido contra o fuso real e corrigido: se o horário
 * de verão voltar, a página não passa a oferecer reunião uma hora errada.
 */
export function deBrasilia(ano:number,mes:number,dia:number,hora:number,minuto:number):number {
 const desejado=Date.UTC(ano,mes-1,dia,hora,minuto)
 let t=desejado+3*3600000
 for(let i=0;i<3;i++){
  const p=emBrasilia(t)
  const erro=Date.UTC(p.ano,p.mes-1,p.dia,p.hora,p.minuto)-desejado
  if(!erro)break
  t-=erro
 }
 return t
}

const cruza=(ini:number,fim:number,ocupados:{inicio:number;fim:number}[])=>
 ocupados.some(o=>ini<o.fim&&fim>o.inicio)

/**
 * Os horários que a pessoa pode escolher.
 *
 * Só dias úteis, só dentro do expediente, sem encostar no que já está ocupado
 * na agenda e sem oferecer algo para daqui a pouco. Tudo calculado na hora de
 * Brasília e devolvido em UTC, que é como o banco guarda.
 */
export function horariosLivres(opts:{
 agora:number
 ocupados:{inicio:number;fim:number}[]
 dias?:number
 duracaoMin?:number
 avisoMinimoMin?:number
}):number[] {
 const dias=opts.dias??JANELA_DIAS
 const duracao=(opts.duracaoMin??DURACAO_MIN)*60000
 const cedoDemais=opts.agora+(opts.avisoMinimoMin??AVISO_MINIMO_MIN)*60000
 const livres:number[]=[]
 const hoje=emBrasilia(opts.agora)
 for(let d=0;d<dias;d++){
  // Caminhar pelo meio-dia evita cair em hora que não existe numa virada de
  // fuso; o dia é lido do fuso, não somado em milissegundos.
  const base=emBrasilia(deBrasilia(hoje.ano,hoje.mes,hoje.dia,12,0)+d*86400000)
  if(base.semana===0||base.semana===6)continue
  for(let h=ABRE_HORA*60;h+duracao/60000<=FECHA_HORA*60;h+=opts.duracaoMin??DURACAO_MIN){
   const inicio=deBrasilia(base.ano,base.mes,base.dia,Math.floor(h/60),h%60)
   const fim=inicio+duracao
   if(inicio<cedoDemais)continue
   if(cruza(inicio,fim,opts.ocupados))continue
   livres.push(inicio)
  }
 }
 return livres
}

/**
 * Quantos horários o dia mostra.
 *
 * Dia com dezoito vagas livres pode dizer ao prospect que a agência está
 * parada. Em 09/10 o João pediu para limitar e, vendo o resultado, preferiu
 * mostrar tudo. Fica como chave de operação, não como decisão gravada em
 * código: `AGENDA_VITRINE=2,4,5,7` liga o limite, vazio mostra todos.
 *
 * Quando ligado, o número sai do próprio dia e é sempre o mesmo: se variasse
 * a cada visita, a pessoa recarregaria a página e veria horário sumir, o que
 * parece defeito e derruba mais confiança do que agenda cheia de vaga.
 */
export const VITRINE_PADRAO=[2,4,5,7]
export function lerVitrine(bruto:string|undefined):number[] {
 return String(bruto||'').split(',').map(n=>Number(n.trim()))
  .filter(n=>Number.isInteger(n)&&n>0&&n<=24)
}
export function quantosNoDia(chave:string,opcoes:number[]=VITRINE_PADRAO) {
 let h=7
 for(const c of chave)h=(h*31+c.charCodeAt(0))|0
 return opcoes[Math.abs(h)%opcoes.length]
}

/**
 * Escolhe quais horários do dia aparecem.
 *
 * Espalha pelo dia em vez de pegar os primeiros: mostrar só 9h, 9h30 e 10h
 * faria parecer que a tarde inteira está tomada, e quem só pode à tarde
 * desistiria. O primeiro e o último livres sempre entram.
 *
 * Isto só ESCONDE horário livre, nunca oferece horário ocupado.
 */
export function vitrineDoDia<T>(horarios:T[],chave:string,opcoes:number[]=VITRINE_PADRAO):T[] {
 if(!opcoes.length)return horarios
 const n=quantosNoDia(chave,opcoes)
 if(horarios.length<=n)return horarios
 const passo=(horarios.length-1)/(n-1)
 const escolhidos=new Set<number>()
 for(let i=0;i<n;i++)escolhidos.add(Math.round(i*passo))
 return [...escolhidos].sort((a,b)=>a-b).map(i=>horarios[i])
}

/** Agrupa por dia para a tela, já com rótulo em português. */
export function porDia(instantes:number[],vitrine:number[]=[]) {
 const SEMANA=['domingo','segunda','terça','quarta','quinta','sexta','sábado']
 const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
 const mapa=new Map<string,{dia:string;rotulo:string;horarios:{inicio:string;hora:string}[]}>()
 for(const t of instantes){
  const p=emBrasilia(t)
  const chave=`${p.ano}-${String(p.mes).padStart(2,'0')}-${String(p.dia).padStart(2,'0')}`
  if(!mapa.has(chave))mapa.set(chave,{dia:chave,rotulo:`${SEMANA[p.semana]}, ${p.dia} de ${MES[p.mes-1]}`,horarios:[]})
  mapa.get(chave)!.horarios.push({inicio:new Date(t).toISOString(),
   hora:`${String(p.hora).padStart(2,'0')}:${String(p.minuto).padStart(2,'0')}`})
 }
 // O corte, quando ligado, entra aqui porque é por DIA. Lista vazia de
 // opções significa mostrar tudo, que é o padrão.
 return [...mapa.values()].map(d=>({...d,horarios:vitrineDoDia(d.horarios,d.dia,vitrine)}))
}

/** Só aceita um horário que a própria regra ofereceria. */
export function horarioValido(inicioISO:string,livres:number[]):number|null {
 const t=Date.parse(inicioISO)
 if(!Number.isFinite(t))return null
 return livres.includes(t)?t:null
}

const SO_DIGITOS=(v:string)=>v.replace(/\D+/g,'')

/** Confere os dados de quem está marcando, sem travar por formatação. */
export function dadosDaReuniao(body:Record<string,unknown>) {
 const texto=(v:unknown,max:number)=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,max):''
 const nome=texto(body.nome,80)
 const email=texto(body.email,120)
 const whatsapp=SO_DIGITOS(texto(body.whatsapp,30))
 const assunto=typeof body.assunto==='string'?body.assunto.trim().slice(0,600):''
 if(nome.length<3)return {erro:'Escreva seu nome completo.'}
 if(!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email))return {erro:'Confira o e-mail: ele precisa estar completo.'}
 // 10 dígitos é fixo com DDD, 11 é celular, 12 e 13 vêm com o 55 na frente.
 if(whatsapp.length<10||whatsapp.length>13)return {erro:'Confira o WhatsApp com DDD.'}
 return {nome,email,whatsapp:whatsapp.length<=11?'55'+whatsapp:whatsapp,assunto}
}
