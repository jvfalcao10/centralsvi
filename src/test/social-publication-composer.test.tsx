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

// João, 07/10: "nos dar a opção de postar tanto no reels quanto nos stories".
const cardVideo:any={...card,id:'v1',selected_assets:['v'],assets:[{id:'v',name:'Reel',url:'/r.mp4',path:'v',type:'video/mp4'}]}
it('publica o mesmo vídeo no reels e no story, um envio para cada',async()=>{
 api.mockImplementation(async(_q:string,b:any)=>b?.action==='publication_enqueue'
  ?{publication:{id:'j-'+b.format,status:'queued',account_username:'qa',format:b.format,scheduled_at:new Date().toISOString()}}
  :{card:cardVideo,accounts:[{id:'123',username:'qa',name:'Cliente QA'}],publication:null})
 render(<PublicationComposer ids={['v1']} cards={[cardVideo]} onClose={()=>{}} onChanged={()=>{}}/>)
 await screen.findByText('Criativo QA')
 fireEvent.change(screen.getByLabelText('Conta do Instagram'),{target:{value:'123'}})
 fireEvent.click(screen.getByRole('checkbox',{name:'Story'}))
 fireEvent.click(screen.getByRole('button',{name:'Publicar agora'}))
 await waitFor(()=>expect(api.mock.calls.filter(([,b])=>b?.action==='publication_enqueue')).toHaveLength(2))
 const envios=api.mock.calls.filter(([,b])=>b?.action==='publication_enqueue').map(([,b])=>b)
 // O feed sai antes do story, porque o story costuma apontar pra ele.
 expect(envios.map(e=>e.format)).toEqual(['reel','story'])
 // Pedido próprio por formato: repetido, o segundo voltaria como o primeiro.
 expect(envios[0].request_id).not.toBe(envios[1].request_id)
})

it('não deixa publicar sem escolher nenhum destino',async()=>{
 api.mockImplementation(async(_q:string,b:any)=>b?{publication:null}:{card:cardVideo,accounts:[{id:'123',username:'qa',name:'Cliente QA'}],publication:null})
 render(<PublicationComposer ids={['v1']} cards={[cardVideo]} onClose={()=>{}} onChanged={()=>{}}/>)
 await screen.findByText('Criativo QA')
 fireEvent.change(screen.getByLabelText('Conta do Instagram'),{target:{value:'123'}})
 fireEvent.click(screen.getByRole('checkbox',{name:'Reels'}))
 expect(screen.getByRole('button',{name:'Publicar agora'})).toBeDisabled()
})
