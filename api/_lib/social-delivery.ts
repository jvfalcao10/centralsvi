import {intakeClient,resolveClient} from './social-intake.js'
import {normalized,whatsappVideo} from './social-sync-domain.js'

// A filename can identify a known client; it cannot prove two different files
// are the same revision. Keep the collector's stable card identity untouched.
export function identifyGroupDelivery(delivery:NonNullable<ReturnType<typeof whatsappVideo>>,catalog:string[],roster:string[]=[]) {
 if(delivery.client!=='Identificar cliente')return {...delivery,client:catalog.find(c=>normalized(c)===normalized(delivery.client))||delivery.client}
 const name=delivery.payload.name.replace(/\.[^.]+$/,'').replace(/\s+v\d{1,3}$/i,'').trim()
 // "Christo Rei - interclasse" tem o cliente antes do traco e a peca depois.
 const prefix=name.split(/\s+-\s+/)[0]
 // Nome do arquivo e declaracao de quem entregou, nao conversa: aceita nome parcial.
 const client=resolveClient(prefix,catalog,roster)
 // Se o prefixo nao bastou, o nome inteiro ainda pode conter o cliente.
 return {...delivery,client:client==='Identificar cliente'&&prefix!==name?resolveClient(name,catalog,roster):client}
}

/**
 * O nome da peça, sem o que marca versão.
 *
 * O arquivo chega "Dra Esia - papinha de bebê v2.MP4" e o card guarda
 * "Dra Esia - papinha de bebê", porque o coletor corta o sufixo ao montar o
 * título. Os dois lados precisam cair na mesma base para se reconhecerem.
 */
export function baseDaPeca(valor:string) {
 return normalized(String(valor||'')
  .replace(/\.[^.]+$/,'')
  .replace(/\s*\((?:novo|nova|final|finalizado|corrigido)\)\s*$/i,'')
  .replace(/\s+v\d{1,3}\s*$/i,''))
}

/**
 * A entrega nova é outra versão de uma peça que já está no quadro?
 *
 * João, 15/10/2026: "o último enviado é o certo". Sem isto, cada reenvio do
 * editor nascia como card NOVO: em 15/10 o quadro tinha a papinha da Dra. Ésia
 * em dois cards, um aprovado e um aguardando, com título idêntico, e nada na
 * tela dizia qual era o mais recente.
 *
 * Peça POSTADA nunca entra: o que foi ao ar é história, e uma entrega depois
 * dela é peça nova. Arquivada também fica de fora, porque foi tirada do fluxo
 * de propósito.
 */
export function pecaQueEleSubstitui(
 delivery:{client:string;payload:{name?:string}},
 cards:{id:string;client:string;title:string;stage:string;posted_at:string|null;created_at?:string}[],
) {
 const base=baseDaPeca(delivery.payload?.name||'')
 if(base.length<3||delivery.client==='Identificar cliente')return null
 const alvo=normalized(delivery.client)
 const candidatos=cards.filter(c=>
  !c.posted_at && c.stage!=='arquivado' &&
  normalized(c.client)===alvo && baseDaPeca(c.title)===base)
 if(!candidatos.length)return null
 // Mais de um já aberto é o próprio defeito que isto corrige: junta no mais
 // recente, que é o que o cliente viu por último.
 return candidatos.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0].id
}
