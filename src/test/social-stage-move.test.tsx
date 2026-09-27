import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within,createEvent} from '@testing-library/react'
import {MemoryRouter,useLocation} from 'react-router-dom'
import Social from '@/pages/content/Social'
import {type Card} from '@/lib/social-board'

const mocks=vi.hoisted(()=>({mobile:false,api:vi.fn(),toast:vi.fn(),drop:null as null|((result:unknown)=>Promise<void>)}))
vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>mocks.mobile}))
vi.mock('@/lib/supabase',()=>({supabase:{}}))
vi.mock('@/lib/social-board',async()=>({...await vi.importActual('@/lib/social-board'),socialApi:mocks.api}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}))
vi.mock('@/components/social/ClientApprovalLink',()=>({default:()=>null}))
vi.mock('@/components/social/FeedbackRouting',()=>({default:()=>null}))
vi.mock('@/components/social/VideoPreview',()=>({default:()=>null,VideoCover:()=>null}))
vi.mock('@hello-pangea/dnd',()=>({
 DragDropContext:({children,onDragEnd}:any)=>{mocks.drop=onDragEnd;return children},
 Droppable:({children}:any)=>children({innerRef:()=>{},droppableProps:{},placeholder:null}),
 Draggable:({children}:any)=>children({innerRef:()=>{},draggableProps:{},dragHandleProps:{}}),
}))
const initial={id:'piece-a',client:'Cliente QA',title:'Vídeo QA',author:'Math',stage:'conferir',revision:1,version:4,assets:[{id:'a',path:'a.mp4',name:'a.mp4',type:'video/mp4'}],selected_assets:['a'],caption:'Legenda',note:'',source_url:'https://web.whatsapp.com/',source_status:'Entregue',source_updated:'2026-09-26T10:00:00Z',approved_by:null,approved_at:null,approval_evidence:null,scheduled_at:null,posted_at:null,posted_url:null,channel:null} satisfies Card
let current:Card
const Location=()=>{const l=useLocation();return <output aria-label="Endereço atual">{l.pathname+l.search}</output>}
const show=()=>render(<MemoryRouter initialEntries={['/content/social']}><Social/><Location/></MemoryRouter>)
const drop=async(target:string,reason='DROP')=>act(async()=>{await mocks.drop!({draggableId:'piece-a',source:{droppableId:current.stage,index:0},destination:{droppableId:target,index:0},reason})})
const writes=()=>mocks.api.mock.calls.filter(args=>args[1])
beforeEach(()=>{
 mocks.mobile=false;current=structuredClone(initial);mocks.api.mockReset();mocks.toast.mockReset();mocks.drop=null
 mocks.api.mockImplementation(async(query='',body)=>{
  if(body){const stages:Record<string,string>={solicitar:'aguardando',aprovar:'aprovado',ajustes:'ajustes',agendar:'agendado',postar:'postado',arquivar:'arquivado',conferir:'conferir'};current={...current,stage:stages[body.action],version:current.version+1};return {ok:true}}
  if(query==='?sync=status')return {sources:[],pending:0,issues:[]}
  if(query.startsWith('?id='))return {card:current,events:[],feedback:null}
  return {cards:[current]}
 })
})
afterEach(cleanup)
describe('moving a Social card stays on the board',()=>{
 it('moves to awaiting client without opening the full piece or changing its URL',async()=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('aguardando')
  expect(writes()).toEqual([['',{id:'piece-a',version:4,action:'solicitar'}]])
  expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByLabelText('Endereço atual')).toHaveTextContent('/content/social');expect(screen.getByLabelText('Endereço atual')).not.toHaveTextContent('peca=')
  expect(mocks.api.mock.calls.some(([q])=>q?.startsWith('?id='))).toBe(false)
  fireEvent.change(screen.getByRole('combobox',{name:'Etapa'}),{target:{value:'aguardando'}})
  expect(await screen.findByRole('button',{name:'Abrir Vídeo QA'})).toBeVisible();expect(screen.queryByRole('dialog')).toBeNull()
 })
 it('requests only the adjustment reason, saves it and returns to the board',async()=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('ajustes')
  const dialog=screen.getByRole('dialog',{name:'Mover para Ajustes'});expect(writes()).toHaveLength(0);expect(within(dialog).queryByText('Arquivos da peça')).toBeNull()
  fireEvent.change(within(dialog).getByLabelText('O que precisa mudar?'),{target:{value:'Corrigir a legenda aos 15 segundos.'}})
  fireEvent.click(within(dialog).getByRole('button',{name:'Salvar etapa'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes()[0][1]).toMatchObject({id:'piece-a',version:4,action:'ajustes',reason:'Corrigir a legenda aos 15 segundos.'})
  expect(screen.getByLabelText('Endereço atual')).not.toHaveTextContent('peca=')
 })
 it('does not treat dragging or canceling as approval',async()=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('aprovado')
  const dialog=screen.getByRole('dialog',{name:'Registrar aprovação'})
  expect(within(dialog).getByLabelText('Quem aprovou?')).toBeRequired();expect(within(dialog).getByLabelText('Onde e quando foi aprovado?')).toBeRequired();expect(writes()).toHaveLength(0)
  fireEvent.click(within(dialog).getByRole('button',{name:'Cancelar'}));expect(screen.queryByRole('dialog')).toBeNull();expect(writes()).toHaveLength(0)
 })
 it('requires date and explicit publication confirmation before marking posted',async()=>{
  current.stage='aprovado';show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('postado')
  const dialog=screen.getByRole('dialog',{name:'Marcar como postado'})
  expect(within(dialog).getByLabelText('Quando foi publicado?')).toBeRequired();expect(within(dialog).getByRole('checkbox')).toBeRequired();expect(writes()).toHaveLength(0)
 })
 it('keeps scheduling on a small form with a required date',async()=>{
  current.stage='aprovado';show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('agendado')
  const dialog=screen.getByRole('dialog',{name:'Agendar postagem'});expect(within(dialog).getByLabelText('Data planejada')).toBeRequired();expect(within(dialog).getByLabelText('Rede e formato')).toHaveValue('Instagram · Feed');expect(writes()).toHaveLength(0)
 })
 it('archives using the valid server action without opening the piece',async()=>{
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('arquivado')
  expect(writes()[0][1]).toMatchObject({action:'arquivar'});expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('button',{name:'Abrir Vídeo QA'})).toBeNull()
 })
 it('leaves a rejected move in place and reports the error',async()=>{
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation(async(q,b)=>{if(b)throw new Error('Esta peça mudou em outra tela. Reabra antes de salvar.');return base(q,b)})
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('aguardando')
  expect(current.stage).toBe('conferir');expect(screen.queryByRole('dialog')).toBeNull();expect(mocks.toast).toHaveBeenCalledWith({description:'Esta peça mudou em outra tela. Reabra antes de salvar.'})
 })
 it('keeps form values on save failure and does not falsely finish the move',async()=>{
  const base=mocks.api.getMockImplementation()!;mocks.api.mockImplementation(async(q,b)=>{if(b)throw new Error('Não foi possível salvar.');return base(q,b)})
  show();await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('ajustes')
  fireEvent.change(screen.getByLabelText('O que precisa mudar?'),{target:{value:'Trocar o início.'}});fireEvent.click(screen.getByRole('button',{name:'Salvar etapa'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar.');expect(screen.getByLabelText('O que precisa mudar?')).toHaveValue('Trocar o início.');expect(current.stage).toBe('conferir')
 })
 it('ignores canceled/same-column drags and suppressed drop clicks but preserves deliberate opening',async()=>{
  show();const button=await screen.findByRole('button',{name:'Abrir Vídeo QA'});await drop('conferir');await drop('aprovado','CANCEL');expect(writes()).toHaveLength(0);expect(screen.queryByRole('dialog')).toBeNull()
  const click=createEvent.click(button);click.preventDefault();fireEvent(button,click);expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(button);await screen.findByRole('dialog',{name:'Vídeo QA'});expect(screen.getByLabelText('Endereço atual')).toHaveTextContent('peca=piece-a')
 })
})


describe('moving Social cards by touch',()=>{
 it('shows a single-stage list and moves without opening the detail panel',async()=>{
  mocks.mobile=true;show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  expect(screen.getByRole('region',{name:'Postagens no celular'})).toBeVisible()
  expect(screen.queryByLabelText('Kanban de postagens')).toBeNull()
  fireEvent.change(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'}),{target:{value:'aguardando'}})
  await waitFor(()=>expect(writes()).toHaveLength(1))
  expect(writes()[0][1]).toEqual({id:'piece-a',version:4,action:'solicitar'})
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByLabelText('Endereço atual')).not.toHaveTextContent('peca=')
  fireEvent.change(screen.getByRole('combobox',{name:'Etapa'}),{target:{value:'aguardando'}})
  expect(await screen.findByRole('button',{name:'Abrir Vídeo QA'})).toBeVisible()
 })
 it('requires approval evidence on mobile and leaves the card unchanged when canceled',async()=>{
  mocks.mobile=true;show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  fireEvent.change(screen.getByRole('combobox',{name:'Mudar etapa de Vídeo QA'}),{target:{value:'aprovado'}})
  const dialog=screen.getByRole('dialog',{name:'Registrar aprovação'})
  expect(within(dialog).getByLabelText('Onde e quando foi aprovado?')).toBeRequired()
  expect(writes()).toHaveLength(0)
  fireEvent.click(within(dialog).getByRole('button',{name:'Cancelar'}))
  expect(screen.queryByRole('dialog')).toBeNull();expect(writes()).toHaveLength(0)
  expect(screen.getByRole('button',{name:'Abrir Vídeo QA'})).toBeVisible()
 })
 it('reveals optional filters and opens details only by tapping the piece',async()=>{
  mocks.mobile=true;show();await screen.findByRole('button',{name:'Abrir Vídeo QA'})
  expect(screen.queryByRole('combobox',{name:'Responsável'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Filtros'}))
  expect(screen.getByRole('combobox',{name:'Responsável'})).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Abrir Vídeo QA'}))
  expect(await screen.findByRole('dialog',{name:'Vídeo QA'})).toBeVisible()
  expect(screen.getByLabelText('Endereço atual')).toHaveTextContent('peca=piece-a')
 })
})
