import {intakeClient} from './social-intake.js'
import {normalized,whatsappVideo} from './social-sync-domain.js'

// A filename can identify a known client; it cannot prove two different files
// are the same revision. Keep the collector's stable card identity untouched.
export function identifyGroupDelivery(delivery:NonNullable<ReturnType<typeof whatsappVideo>>,catalog:string[]) {
 if(delivery.client!=='Identificar cliente')return {...delivery,client:catalog.find(c=>normalized(c)===normalized(delivery.client))||delivery.client}
 const name=delivery.payload.name.replace(/\.[^.]+$/,'').replace(/\s+v\d{1,3}$/i,'').trim()
 const prefix=name.split(/\s+-\s+/)[0]
 const client=intakeClient(prefix,catalog)
 return {...delivery,client}
}
