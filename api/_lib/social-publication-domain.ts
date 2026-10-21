import {SocialError,type SocialCard,type SocialAsset} from './social-domain.js'
export type PublicationAccount={id:string;username:string;name:string}
export type PublicationJob={id:string;card_id:string;revision:number;actor:string;actor_id:string;account_id:string;account_username:string;format:string;caption:string;assets:SocialAsset[];cover_path:string|null;cover_offset_ms:number|null;scheduled_at:string;status:string;progress:Record<string,any>;lease_id:string;attempts:number;error:string|null;media_id:string|null;permalink:string|null;published_at:string|null}
const fail=(message:string):never=>{throw new SocialError(400,message)}

/**
 * O número que o nome do arquivo dá para a lâmina.
 *
 * Os nomes da casa terminam na posição: "RAFAEL-k1-rev-03.jpg",
 * "DR-FELIPE-C6-39-anos-v2-lamina-07.jpg", "01.jpg". O último número é o que
 * vale, porque antes dele vem cliente, versão e data.
 */
export function numeroDaLamina(nome:string){
 const n=String(nome||'').replace(/\.[a-z0-9]{2,5}$/i,'').match(/\d+/g)
 return n?Number(n[n.length-1]):null
}

/**
 * Carrossel fora de ordem não sai.
 *
 * João, 18/10/2026: "carrossel do Brenno saiu com slide fora de ordem e foi
 * enviado no grupo". Naquele dia a conferência veio depois, com a peça já na
 * mão do cliente. João, 20/10: "deve ser antes de publicar na verdade, né".
 *
 * A checagem não precisa do Instagram: se os arquivos marcados são numerados,
 * a ordem de publicação tem que seguir o número. Arquivo sem número não é
 * cobrado, porque aí o nome não diz nada sobre posição.
 */
export function ordemDasLaminas(media:{name:string}[]){
 const numeros=media.map(a=>numeroDaLamina(a.name))
 if(numeros.some(n=>n===null))return ''
 const n=numeros as number[]
 if(new Set(n).size!==n.length)return ''
 for(let i=1;i<n.length;i++){
  if(n[i]<n[i-1])return `Os arquivos estão marcados fora da ordem: a lâmina ${n[i]} vem depois da ${n[i-1]} (posição ${i+1} do carrossel). Remarque na ordem antes de publicar.`
 }
 return ''
}
export function publicationInput(card:SocialCard,body:Record<string,any>,accounts:PublicationAccount[],actorId:string,now=Date.now()) {
 if(body.confirmed!==true)fail('Confira a publicação antes de enviar.')
 if(card.ingest_pending||!card.selected_assets.length||card.client==='Identificar cliente')fail('Confira o cliente e os arquivos finais da peça.')
 if(!['aprovado','agendado','para_anuncio'].includes(card.stage))fail('Mova a peça para Aprovado antes de publicar.')
 if(card.stage==='postado'||card.posted_at)fail('Esta peça já foi postada.')
 if(!/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.request_id||''))fail('Reabra a janela de publicação.')
 const account=accounts.find(a=>a.id===body.account_id);if(!account)fail('Escolha uma conta conectada.')
 const assets=card.selected_assets.map(id=>card.assets.find(a=>a.id===id));if(assets.some(a=>!a))fail('Um dos arquivos não está disponível.')
 const media=assets as SocialAsset[],videos=media.filter(a=>a.type.startsWith('video/')),images=media.filter(a=>a.type.startsWith('image/'))
 const format=body.format
 if(!['image','reel','carousel','story'].includes(format))fail('Escolha o formato da publicação.')
 if(media.length!==videos.length+images.length)fail('Há um arquivo que não é imagem nem vídeo.')
 if(format==='image'&&(media.length!==1||images.length!==1))fail('Uma publicação de imagem precisa de uma imagem.')
 if(format==='reel'&&(media.length!==1||videos.length!==1))fail('Reels precisa de um vídeo.')
 if(format==='story'&&media.length!==1)fail('Programe cada Story separadamente.')
 if(format==='carousel'&&(media.length<2||media.length>10))fail('O carrossel aceita de 2 a 10 arquivos.')
 if(format==='carousel'){const foraDeOrdem=ordemDasLaminas(media);if(foraDeOrdem)fail(foraDeOrdem)}
 if(format==='carousel'&&videos.some(a=>a.storage==='drive'))fail('Para este vídeo do Drive, escolha Reels. Carrossel com vídeo do Drive ainda não está disponível.')
 if(videos.some(a=>a.bytes&&a.bytes>500*1024*1024))fail('Use um vídeo de até 500 MB.')
 if(format==='story'&&videos.some(a=>a.bytes&&a.bytes>100*1024*1024))fail('O vídeo do Story precisa ter até 100 MB.')
 const caption=typeof body.caption==='string'?body.caption.trim():card.caption
 if(caption.length>2200)fail('A legenda precisa ter até 2.200 caracteres.')
 const scheduled=body.when==='now'?now:Date.parse(body.scheduled_at)
 if(!Number.isFinite(scheduled)||(body.when!=='now'&&scheduled<now+60000)||scheduled>now+365*86400000)fail('Escolha um horário futuro válido.')
 const cover=body.cover_path||null,offset=body.cover_offset_ms==null?0:Number(body.cover_offset_ms)
 if(cover&&(typeof cover!=='string'||!new RegExp(`^publication-covers/${actorId}/[a-f0-9-]+\\.jpg$`).test(cover)))fail('Envie a capa novamente.')
 if(!Number.isInteger(offset)||offset<0||offset>900000||(videos[0]?.duration_ms&&offset>=videos[0].duration_ms))fail('Escolha um instante dentro do vídeo para a capa.')
 return {account_id:account.id,account_username:account.username,format,caption,assets:media,scheduled_at:new Date(scheduled).toISOString(),cover_path:format==='reel'?cover:null,cover_offset_ms:format==='reel'&&!cover?offset:null}
}
export function publicPublication(job:Partial<PublicationJob>|null){if(!job)return null;const {id,status,account_username,format,scheduled_at,error,permalink,published_at}=job;return {id,status,account_username,format,scheduled_at,error,permalink,published_at}}
