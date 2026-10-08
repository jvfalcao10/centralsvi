import {CardContextMenu} from '@/components/social/CardActions'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,createEvent} from '@testing-library/react'
import {MemoryRouter,useLocation} from 'react-router-dom'
import Social from '@/pages/content/Social'
import {type Card} from '@/lib/social-board'

const mocks=vi.hoisted(()=>({mobile:false,api:vi.fn(),toast:vi.fn(),drop:null as null|((result:unknown)=>void),start:null as null|(()=>void)}))
vi.mock('@/hooks/use-social-touch-layout',()=>({useSocialTouchLayout:()=>mocks.mobile}))
vi.mock('@/lib/supabase',()=>({supabase:{}}))
vi.mock('@/lib/social-board',async()=>({...await vi.importActual('@/lib/social-board'),socialApi:mocks.api}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}))
vi.mock('@/components/social/ClientApprovalLink',()=>({default:()=>null}))
vi.mock('@/components/social/FeedbackRouting',()=>({default:()=>null}))
vi.mock('@/components/social/VideoPreview',()=>({default:()=>null,VideoCover:()=>null}))
vi.mock('@hello-pangea/dnd',()=>({
 DragDropContext:({children,onDragEnd,onDragStart}:any)=>{mocks.drop=onDragEnd;mocks.start=onDragStart;return children},
 Droppable:({children}:any)=>children({innerRef:()=>{},droppableProps:{},placeholder:null}),
 Draggable:({children}:any)=>children({innerRef:()=>{},draggableProps:{},dragHandleProps:{}}),
}))
const initial={id:'piece-a',client:'Cliente QA',title:'Vídeo QA',author:'Math',stage:'conferir',revision:1,version:4,assets:[{id:'a',path:'a.mp4',name:'a.mp4',type:'video/mp4'}],selected_assets:['a'],caption:'Legenda',note:'',source_url:'https://web.whatsapp.com/',source_status:'Entregue',source_updated:'2026-09-26T10:00:00Z',approved_by:null,approved_at:null,approval_evidence:null,scheduled_at:null,posted_at:null,posted_url:null,channel:null} satisfies Card
let current:Card
const Location=()=>{const l=useLocation();return <output aria-label="Endereço atual">{l.pathname+l.search}</output>}
const show=()=>render(<MemoryRouter initialEntries={['/content/social']}><Social/><Location/></MemoryRouter>)
const drop=async(target:string,reason='DROP')=>act(async()=>{mocks.drop!({draggableId:'piece-a',source:{droppableId:current.stage,index:0},destination:{droppableId:target,index:0},reason})})
const writes=()=>mocks.api.mock.calls.filter(args=>args[1])
beforeEach(()=>{
 if(!globalThis.DOMRect)vi.stubGlobal('DOMRect',class {static fromRect(r:any){return {...r,top:r.y,left:r.x,right:r.x+r.width,bottom:r.y+r.height,toJSON:()=>r}}})
 mocks.mobile=false;current=structuredClone(initial);mocks.api.mockReset();mocks.toast.mockReset();mocks.drop=null
 mocks.api.mockImplementation(async(query='',body)=>{
  if(body){current={...current,stage:body.stage||current.stage,version:current.version+1};return {ok:true,card:{...current}}}
  if(query.startsWith('?publication=1'))return {card:current,accounts:[{id:'123',username:'qa',name:'QA'}],publication:null}
  if(query==='?sync=status')return {sources:[],pending:0,issues:[]}
  if(query.startsWith('?id='))return {card:current,events:[],feedback:null}
  return {cards:[current]}
 })
})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('direct staff movements',()=>{
 it('keeps scrolling horizontally while the held pointer is near the board edge and stops after drop',async()=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  const board=screen.getByLabelText('Kanban de postagens'),frames:FrameRequestCallback[]=[]
  const raf=vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frames.push(cb);return frames.length})
  const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{})
  vi.spyOn(board,'getBoundingClientRect').mockReturnValue({left:100,right:900,top:100,bottom:700,width:800,height:600,x:100,y:100,toJSON:()=>({})})
  act(()=>mocks.start!());fireEvent.mouseMove(window,{clientX:910,clientY:300})
  act(()=>frames.shift()!(16));const first=board.scrollLeft;act(()=>frames.shift()!(32))
  expect(first).toBeGreaterThan(0);expect(board.scrollLeft).toBeGreaterThan(first)
  await drop('conferir','CANCEL');expect(cancel).toHaveBeenCalled()
  raf.mockRestore();cancel.mockRestore()
 })
 it.each(['aguardando','aprovado','ajustes','para_anuncio','agendado','postado','arquivado'])('moves to %s without asking for a form or opening the piece',async stage=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop(stage)
  await waitFor(()=>expect(writes()).toEqual([['',{id:'piece-a',version:4,action:'mover',stage}]]))
  if(['aprovado','agendado'].includes(stage)){expect(screen.getByRole('dialog')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Agora não'}));expect(writes()).toHaveLength(1)}else expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByLabelText('Endereço atual')).not.toHaveTextContent('peca=')
  expect(mocks.api.mock.calls.some(([q])=>q?.startsWith('?id='))).toBe(false)
 })
 it('can move a posted card back to review',async()=>{
  current.stage='postado';show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('conferir')
  await waitFor(()=>expect(writes()[0][1]).toMatchObject({stage:'conferir'}));expect(screen.queryByRole('dialog')).toBeNull()
 })
 it('does not duplicate writes while a move is pending',async()=>{
  let finish!:()=>void
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation(async(q,b)=>{if(b)await new Promise<void>(resolve=>{finish=resolve});return base(q,b)})
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('postado');await drop('ajustes');expect(writes()).toHaveLength(1)
  await act(async()=>{finish()})
 })
 it('leaves a failed move in place and reports a conflict',async()=>{
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation(async(q,b)=>{if(b)throw new Error('Esta peça mudou em outra tela.');return base(q,b)})
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('postado')
  expect(current.stage).toBe('conferir');expect(screen.queryByRole('dialog')).toBeNull();expect(mocks.toast).toHaveBeenCalledWith({description:'Esta peça mudou em outra tela.'})
 })
 it('ignores canceled/same-column drags and suppressed clicks',async()=>{
  show();const button=await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('conferir');await drop('postado','CANCEL');expect(writes()).toHaveLength(0)
  const click=createEvent.click(button);click.preventDefault();fireEvent(button,click);expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(button);await screen.findByRole('dialog',{name:'Vídeo QA'})
 })
 it('uses the same one-step move in the opened detail',async()=>{
  show();fireEvent.click(await screen.findByRole('button',{name:'Abrir Vídeo QA'}));await screen.findByRole('dialog',{name:'Vídeo QA'})
  fireEvent.change(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'}),{target:{value:'postado'}})
  await waitFor(()=>expect(writes()[0][1]).toMatchObject({action:'mover',stage:'postado'}))
  expect(screen.queryByLabelText('Comprovante da aprovação')).toBeNull()
 })
 it('right-click offers stages without opening details and executes the selected move',async()=>{
  show();fireEvent.contextMenu(await screen.findByRole('button',{name:'Abrir Vídeo QA'}))
  expect(await screen.findByRole('menuitem',{name:'Copiar legenda'})).toBeVisible();expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('menuitem',{name:'Postado'}))
  await waitFor(()=>expect(writes()[0][1]).toMatchObject({action:'mover',stage:'postado'}));expect(screen.queryByRole('dialog')).toBeNull()
 })
})
describe('touch controls',()=>{
 it('moves directly by the stage selector on mobile',async()=>{
  mocks.mobile=true;show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  expect(screen.getByRole('region',{name:'Kanban de postagens no toque'})).toBeVisible()
  fireEvent.change(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'}),{target:{value:'postado'}})
  await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][1]).toMatchObject({action:'mover',stage:'postado'});expect(screen.queryByRole('dialog')).toBeNull()
 })
 it('opens the three-dot menu without opening the piece',async()=>{
  mocks.mobile=true;show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  fireEvent.keyDown(screen.getByRole('button',{name:'Opções de Vídeo QA'}),{key:'Enter'})
  expect(await screen.findByRole('menuitem',{name:'Agendado'})).toBeVisible();expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('menuitem',{name:'Agendado'}))
  await waitFor(()=>expect(writes()[0][1]).toMatchObject({stage:'agendado'}))
 })
})

describe('fast stage feedback',()=>{
 it('shows the destination before the write completes and does not reload the board on success',async()=>{
  let finish!:()=>void
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation(async(q,b)=>{if(b)await new Promise<void>(resolve=>{finish=resolve});return base(q,b)})
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});const reads=mocks.api.mock.calls.filter(([,body])=>!body).length
  await drop('postado')
  expect(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'})).toHaveValue('postado')
  expect(screen.getByText('Salvando em Postado…')).toBeVisible();expect(mocks.toast).not.toHaveBeenCalled()
  await act(async()=>{finish()})
  expect(screen.queryByText('Salvando em Postado…')).toBeNull();expect(mocks.api.mock.calls.filter(([,body])=>!body)).toHaveLength(reads)
  mocks.api.mockImplementation(base);await drop('conferir');expect(writes()[1][1].version).toBe(5)
 })
 it('does not wait for sync health to show the cards',async()=>{
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation((q,b)=>q==='?sync=status'?new Promise(()=>{}):base(q,b))
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});expect(screen.queryByText('Carregando o quadro…')).toBeNull()
  await drop('postado');expect(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'})).toHaveValue('postado')
 })
 it('ignores an old board response that arrives after a saved movement',async()=>{
  const base=mocks.api.getMockImplementation()!;let finish!:(d:unknown)=>void
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  const old=structuredClone(current)
  mocks.api.mockImplementation((q='',b)=>!q&&!b?new Promise(resolve=>{finish=resolve}):base(q,b))
  fireEvent.click(screen.getByRole('button',{name:'Atualizar quadro'}));await drop('postado')
  await act(async()=>finish({cards:[old]}))
  expect(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'})).toHaveValue('postado')
 })
 it('restores the stage if saving fails after the optimistic movement',async()=>{
  let fail!:(e:Error)=>void
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation((q,b)=>b?new Promise((_,reject)=>{fail=reject}):base(q,b))
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('postado')
  expect(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'})).toHaveValue('postado')
  await act(async()=>fail(new Error('Sem conexão.')))
  expect(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'})).toHaveValue('conferir');expect(mocks.toast).toHaveBeenCalledWith({description:'Sem conexão.'})
 })
})

describe('bulk selection',()=>{
 let rows:Card[]
 beforeEach(()=>{
  rows=[structuredClone(initial),{...structuredClone(initial),id:'piece-b',title:'Segunda peça'}]
  mocks.api.mockImplementation(async(q='',body)=>{
   if(body?.action==='mover_lote'){
    const ids=body.items.map((r:{id:string})=>r.id);rows=rows.map(c=>ids.includes(c.id)?{...c,stage:body.stage,version:c.version+1}:c)
    return {results:rows.filter(c=>ids.includes(c.id)).map(c=>({id:c.id,ok:true,card:c}))}
   }
   if(q==='?sync=status')return {sources:[],issues:[],pending:0}
   return {cards:structuredClone(rows)}
  })
 })
 it.each([false,true])('selects two pieces without opening details and moves with one request (touch %s)',async mobile=>{
  mocks.mobile=mobile;show();await screen.findByRole('checkbox',{name:'Selecionar Vídeo QA'})
  fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar Vídeo QA'}));fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar Segunda peça'}))
  expect(screen.getByText('2 selecionadas')).toBeVisible();expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.change(screen.getByRole('combobox',{name:'Mover selecionadas para'}),{target:{value:'para_anuncio'}})
  await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][1]).toEqual({action:'mover_lote',stage:'para_anuncio',items:[{id:'piece-a',version:4},{id:'piece-b',version:4}]})
  await waitFor(()=>expect(screen.getByText('0 selecionadas')).toBeVisible());expect(rows.every(c=>c.stage==='para_anuncio')).toBe(true)
 })
 it('selects all matching results, including more cards in each touch column, and clears when filters change',async()=>{
  mocks.mobile=true;rows=Array.from({length:14},(_,i)=>({...structuredClone(initial),id:'p'+i,title:'Peça '+i,source_updated:new Date(Date.UTC(2026,8,27)-i*60000).toISOString()}));show()
  await screen.findByRole('checkbox',{name:'Selecionar Peça 0'});expect(screen.queryByRole('checkbox',{name:'Selecionar Peça 13'})).toBeNull()
  fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar todos os resultados'}));expect(screen.getByText('14 selecionadas')).toBeVisible()
  fireEvent.change(screen.getByRole('textbox',{name:'Buscar peça'}),{target:{value:'Peça 13'}});expect(screen.getByText('0 selecionadas')).toBeVisible()
  fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar todos os resultados'}));expect(screen.getByText('1 selecionada')).toBeVisible()
 })
 it('shows newest deliveries first in each column, including after a move',async()=>{
  rows[0].source_updated='2026-09-24T10:00:00Z';rows[1].source_updated='2026-09-27T10:00:00Z'
  show();await screen.findByRole('checkbox',{name:'Selecionar Vídeo QA'})
  const titles=()=>screen.getAllByRole('button',{name:/^Abrir /}).map(el=>el.getAttribute('aria-label'))
  expect(titles()).toEqual(['Abrir Segunda peça','Abrir Vídeo QA'])
  fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar todos os resultados'}))
  fireEvent.change(screen.getByRole('combobox',{name:'Mover selecionadas para'}),{target:{value:'postado'}})
  await waitFor(()=>expect(screen.getByText('0 selecionadas')).toBeVisible())
  expect(titles()).toEqual(['Abrir Segunda peça','Abrir Vídeo QA'])
 })
 it('keeps failed cards selected and explains why, preserving successful moves',async()=>{
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation(async(q,b)=>{
   if(b?.action==='mover_lote'){rows[0]={...rows[0],stage:b.stage,version:5};return {results:[{id:'piece-a',ok:true,card:rows[0]},{id:'piece-b',ok:false,error:'Esta peça mudou em outra tela.'}]}}
   return base(q,b)
  })
  show();await screen.findByRole('checkbox',{name:'Selecionar todos os resultados'});await screen.findByRole('checkbox',{name:'Selecionar Vídeo QA'})
  fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar todos os resultados'}));fireEvent.change(screen.getByRole('combobox',{name:'Mover selecionadas para'}),{target:{value:'postado'}})
  await screen.findByText('Segunda peça: Esta peça mudou em outra tela.')
  expect(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'})).toHaveValue('postado');expect(screen.getByRole('combobox',{name:'Mudar etapa de Segunda peça'})).toHaveValue('conferir')
  expect(screen.getByRole('checkbox',{name:'Selecionar Segunda peça'})).toBeChecked();expect(screen.getByRole('checkbox',{name:'Selecionar Vídeo QA'})).not.toBeChecked()
 })
})

// João, 08/10: "quando eu clicar com botão direito no card vai aparecer enviar
// pro cliente aprovar?" Não aparecia: os dois gestos estavam só no painel da
// peça, e é no menu do card que ele trabalha.
describe('menu do card tem os gestos do dia a dia',()=>{
 const peca={id:'c1',client:'Cliente',title:'Peça',author:'José',stage:'conferir',version:1,revision:1,
  assets:[{id:'a',name:'1.png',type:'image/png',path:'p'}],selected_assets:['a'],caption:'',note:'',
  source_url:'',source_status:'',source_updated:new Date().toISOString(),approved_by:null,approved_at:null,
  approval_evidence:null,scheduled_at:null,posted_at:null,posted_url:null,channel:null} as never

 it('mostra mandar pro cliente e pedir ajuste, com o nome de quem entregou',async()=>{
  const enviar=vi.fn(),ajuste=vi.fn()
  render(<CardContextMenu card={peca} busy={false} onOpen={()=>{}} onMove={()=>{}} onCopy={()=>{}}
   onEnviarCliente={enviar} onPedirAjuste={ajuste}><div>card</div></CardContextMenu>)
  fireEvent.contextMenu(screen.getByText('card'))
  fireEvent.click(await screen.findByText('Mandar para o cliente aprovar'))
  expect(enviar).toHaveBeenCalledWith('c1')
  fireEvent.contextMenu(screen.getByText('card'))
  fireEvent.click(await screen.findByText('Pedir ajuste para José'))
  expect(ajuste).toHaveBeenCalledWith('c1')
 })

 it('peça já postada não oferece os dois',async()=>{
  render(<CardContextMenu card={{...(peca as object),stage:'postado'} as never} busy={false} onOpen={()=>{}} onMove={()=>{}}
   onCopy={()=>{}} onEnviarCliente={()=>{}} onPedirAjuste={()=>{}}><div>card2</div></CardContextMenu>)
  fireEvent.contextMenu(screen.getByText('card2'))
  expect(await screen.findByText('Mandar para o cliente aprovar')).toHaveAttribute('aria-disabled','true')
 })
})
