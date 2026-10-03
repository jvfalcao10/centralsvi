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
