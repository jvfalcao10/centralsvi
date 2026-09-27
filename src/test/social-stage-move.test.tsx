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
  if(body){current={...current,stage:body.stage||current.stage,version:current.version+1};return {ok:true}}
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
 it.each(['aguardando','aprovado','ajustes','agendado','postado','arquivado'])('moves to %s without asking for a form or opening the piece',async stage=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop(stage)
  await waitFor(()=>expect(writes()).toEqual([['',{id:'piece-a',version:4,action:'mover',stage}]]))
  expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByLabelText('Endereço atual')).not.toHaveTextContent('peca=')
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
  expect(screen.getByRole('region',{name:'Postagens no celular'})).toBeVisible()
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
