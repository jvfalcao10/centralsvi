import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import PublicationComposer from '@/components/social/PublicationComposer'
vi.mock('@/lib/supabase',()=>({supabase:{}}))
const api=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/social-board',async()=>({...await vi.importActual('@/lib/social-board'),socialApi:api}))
const card:any={id:'qa',version:4,revision:1,stage:'aprovado',client:'Cliente QA',title:'Criativo QA',caption:'Legenda original',selected_assets:['a'],assets:[{id:'a',name:'Foto',url:'/foto.jpg',path:'a',type:'image/jpeg'}]}
beforeEach(()=>{api.mockReset();api.mockImplementation(async(q,b)=>b?.action==='publication_enqueue'?{publication:{id:'j',status:'queued',account_username:'qa',scheduled_at:new Date().toISOString()}}:b?.action==='caption_generate'?{caption:'Frase um.\n\nFrase dois.\n\nFaça seu pedido.\n\n#Tema #Marca #Produto #Cidade'}:{card,accounts:[{id:'123',username:'qa',name:'Cliente QA'}],publication:null})})
afterEach(cleanup)
it('closing an approval prompt does not publish',async()=>{const close=vi.fn();render(<PublicationComposer ids={['qa']} cards={[card]} onClose={close} onChanged={()=>{}}/>);await screen.findByText('Peça aprovada. Publicar agora?');fireEvent.click(screen.getByRole('button',{name:'Agora não'}));expect(close).toHaveBeenCalled();expect(api.mock.calls.filter(([,b])=>b)).toHaveLength(0)})
it('requires selecting the destination before sending and sends a confirmed immutable request id',async()=>{render(<PublicationComposer ids={['qa']} cards={[card]} onClose={()=>{}} onChanged={()=>{}}/>);await screen.findByText('Criativo QA');expect(screen.getByRole('button',{name:'Publicar agora'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Conta do Instagram'),{target:{value:'123'}});fireEvent.click(screen.getByRole('button',{name:'Publicar agora'}));await waitFor(()=>expect(api.mock.calls.some(([,b])=>b?.action==='publication_enqueue')).toBe(true));expect(api.mock.calls.find(([,b])=>b?.action==='publication_enqueue')?.[1]).toMatchObject({account_id:'123',confirmed:true,version:4,request_id:expect.any(String),when:'now'})})
it('generates a draft and leaves it editable without publishing',async()=>{render(<PublicationComposer ids={['qa']} cards={[card]} onClose={()=>{}} onChanged={()=>{}}/>);await screen.findByText('Criativo QA');fireEvent.click(screen.getByText('Gerar legenda com IA · Copy Bárbara'));fireEvent.click(screen.getByRole('button',{name:'Gerar legenda'}));await waitFor(()=>expect((screen.getByLabelText('Legenda da publicação') as HTMLTextAreaElement).value).toContain('#Tema'));fireEvent.change(screen.getByLabelText('Legenda da publicação'),{target:{value:'Minha edição.'}});expect(screen.getByLabelText('Legenda da publicação')).toHaveValue('Minha edição.');expect(api.mock.calls.some(([,b])=>b?.action==='publication_enqueue')).toBe(false)})
it('keeps a future date in the explicit Belém timezone',async()=>{render(<PublicationComposer ids={['qa']} cards={[card]} schedule onClose={()=>{}} onChanged={()=>{}}/>);await screen.findByText('Criativo QA');fireEvent.change(screen.getByLabelText('Conta do Instagram'),{target:{value:'123'}});fireEvent.change(screen.getByLabelText('Data e hora · Belém (UTC−3)'),{target:{value:'2026-10-05T09:30'}});fireEvent.click(screen.getByRole('button',{name:'Programar postagem'}));await waitFor(()=>expect(api.mock.calls.some(([,b])=>b?.scheduled_at==='2026-10-05T12:30:00.000Z')).toBe(true))})

it('does not offer a second publication for a manually posted piece',async()=>{api.mockResolvedValue({card:{...card,stage:'postado'},accounts:[],publication:null});render(<PublicationComposer ids={['qa']} cards={[card]} onClose={()=>{}} onChanged={()=>{}}/>);await screen.findByText('Esta peça já está em Postado. Consulte o registro de publicação nos detalhes.');expect(screen.queryByRole('button',{name:'Publicar agora'})).toBeNull()})

// Reels + Story foi DESLIGADO em 07/10 depois de auditoria externa: a fila
// bloqueia o segundo formato por índice único, o gatilho da peça cancela o
// segundo quando o primeiro conclui, e `begin` exige etapa "agendado", que o
// primeiro já mudou. Enquanto os cinco pontos não forem coordenados, a tela
// oferece um destino por vez, que é o que o sistema sustenta.
const cardVideo:any={...card,id:'v1',selected_assets:['v'],assets:[{id:'v',name:'Reel',url:'/r.mp4',path:'v',type:'video/mp4'}]}
// Os dois destinos saem num ENVIO só. Em duas chamadas a primeira incrementa a
// versão da peça e a segunda era recusada com version_conflict. Provado no banco
// com peça de teste: os dois entram, o reel conclui e o story sobrevive.
it('manda os dois destinos num envio só, com o feed primeiro',async()=>{
 api.mockImplementation(async(_q:string,b:any)=>b?.action==='publication_enqueue'
  ?{publication:{id:'j',status:'queued',account_username:'qa',format:b.format,scheduled_at:new Date().toISOString()}}
  :{card:cardVideo,accounts:[{id:'123',username:'qa',name:'Cliente QA'}],publication:null})
 render(<PublicationComposer ids={['v1']} cards={[cardVideo]} onClose={()=>{}} onChanged={()=>{}}/>)
 await screen.findByText('Criativo QA')
 fireEvent.change(screen.getByLabelText('Conta do Instagram'),{target:{value:'123'}})
 fireEvent.click(screen.getByRole('checkbox',{name:'Story'}))
 fireEvent.click(screen.getByRole('button',{name:'Publicar agora'}))
 await waitFor(()=>expect(api.mock.calls.some(([,b])=>b?.action==='publication_enqueue')).toBe(true))
 const envios=api.mock.calls.filter(([,b])=>b?.action==='publication_enqueue').map(([,b])=>b)
 expect(envios,'os dois destinos vão numa chamada, não em duas').toHaveLength(1)
 expect(envios[0].format).toBe('reel')
 expect(envios[0].extra_formats).toEqual(['story'])
 // Pedido próprio por destino: repetido, o segundo voltaria como o primeiro.
 expect(envios[0].extra_request_ids.story).not.toBe(envios[0].request_id)
})

