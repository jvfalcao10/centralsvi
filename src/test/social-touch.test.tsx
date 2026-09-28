import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react'
import MobileSocialBoard from '@/components/social/MobileSocialBoard'
import {useSocialTouchLayout,SOCIAL_TOUCH_QUERY} from '@/hooks/use-social-touch-layout'
import {SOCIAL_STAGES,type Card} from '@/lib/social-board'

vi.mock('@/lib/supabase',()=>({supabase:{}}))
vi.mock('@/components/social/VideoPreview',()=>({VideoCover:()=> <div>Prévia</div>}))
const card={id:'touch-qa',client:'Cliente QA',title:'Peça de teste',author:'Math',stage:'conferir',revision:1,version:1,assets:[],selected_assets:[],caption:'',note:'',source_url:'',source_status:'',source_updated:'',approved_by:null,approved_at:null,approval_evidence:null,scheduled_at:null,posted_at:null,posted_url:null,channel:null} satisfies Card
const move=vi.fn(),open=vi.fn()
function show(busy=false){return render(<MobileSocialBoard cards={[card]} columns={SOCIAL_STAGES} filterKey="" busy={busy} onOpen={open} onMove={move} onCopy={()=>{}}/>)}
const point=(x:number,y:number)=>({pointerId:1,isPrimary:true,pointerType:'touch',button:0,clientX:x,clientY:y})
const begin=async()=>{
 fireEvent.pointerDown(screen.getByRole('button',{name:'Mover Peça de teste'}),point(60,60))
 fireEvent.pointerMove(document,point(75,75))
 await screen.findByRole('status',{name:'Arrastando peça'})
}
beforeEach(()=>{
 move.mockReset();open.mockReset()
 vi.stubGlobal('PointerEvent',class extends MouseEvent {
  pointerId:number;isPrimary:boolean;pointerType:string
  constructor(type:string,init:any={}){super(type,init);this.pointerId=init.pointerId;this.isPrimary=init.isPrimary;this.pointerType=init.pointerType}
 })
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){
  const target=this.getAttribute('data-touch-stage')||this.getAttribute('data-touch-stage-list')
  if(this.getAttribute('aria-label')==='Colunas de postagens')return {x:10,y:10,left:10,top:10,right:510,bottom:710,width:500,height:700,toJSON:()=>({})}
  const x=target==='postado'?200:target?450:10,y=target?400:10,width=target?150:300,height=target?60:200
  return {x,y,left:x,top:y,right:x+width,bottom:y+height,width,height,toJSON:()=>({})}
 })
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('touch scrolling and moving',()=>{
 it('leaves the card body free of drag and long-press menus',async()=>{
  show();const body=screen.getByRole('button',{name:'Abrir Peça de teste'})
  fireEvent.pointerDown(body,point(60,100));fireEvent.pointerMove(document,point(60,250));fireEvent.pointerUp(document,point(60,250))
  fireEvent.contextMenu(body)
  expect(screen.queryByRole('menu')).toBeNull();expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull();expect(move).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled()
 })
 it('moves exactly once with a real touch pointer drag to Postado',async()=>{
  show();await begin();fireEvent.pointerMove(document,point(250,430))
  await waitFor(()=>expect(screen.getByRole('region',{name:/^Postado$/})).toHaveClass('bg-primary/10'))
  fireEvent.pointerUp(document,point(250,430))
  await waitFor(()=>expect(move).toHaveBeenCalledExactlyOnceWith(card.id,'postado'))
  expect(open).not.toHaveBeenCalled();expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull()
 })
 it('keeps the stage columns side by side and scrolls toward an off-screen stage during a held drag',async()=>{
  show();expect(screen.getAllByRole('heading',{level:2})).toHaveLength(SOCIAL_STAGES.length)
  const board=screen.getByLabelText('Colunas de postagens')
  await begin();fireEvent.pointerMove(document,point(505,100))
  await waitFor(()=>expect(board.scrollLeft).toBeGreaterThan(0))
  const first=board.scrollLeft;await waitFor(()=>expect(board.scrollLeft).toBeGreaterThan(first))
  await act(async()=>{fireEvent.pointerCancel(document,point(505,100))});expect(move).not.toHaveBeenCalled()
 })
 it('scrolls down inside the destination column while the handle is held near its lower edge',async()=>{
  show();await begin();fireEvent.pointerMove(document,point(250,455))
  const list=screen.getByRole('region',{name:/^Postado$/}).querySelector('[data-touch-stage-list]')!
  await waitFor(()=>expect(list.scrollTop).toBeGreaterThan(0))
  await act(async()=>{fireEvent.pointerCancel(document,point(250,455))});expect(move).not.toHaveBeenCalled()
 })
 it('does not move when released outside a destination',async()=>{
  show();await begin();fireEvent.pointerMove(document,point(100,300));await act(async()=>{fireEvent.pointerUp(document,point(100,300))})
  expect(move).not.toHaveBeenCalled();expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull()
 })
 it('cancels an interrupted gesture without changing the piece',async()=>{
  show();await begin();await act(async()=>{fireEvent.pointerCancel(document,point(75,75))})
  expect(move).not.toHaveBeenCalled();expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull()
 })
 it('also lets the user tap the handle then a stage without dragging',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'Mover Peça de teste'}))
  expect(screen.getByRole('button',{name:'Conferir aprovação'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Postado'}))
  expect(move).toHaveBeenCalledExactlyOnceWith(card.id,'postado');expect(open).not.toHaveBeenCalled()
 })
 it('offers cancel and escape without any write',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'Mover Peça de teste'}));fireEvent.click(screen.getByRole('button',{name:'Cancelar mudança de etapa'}))
  expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Mover Peça de teste'}));fireEvent.keyDown(window,{key:'Escape'})
  expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull();expect(move).not.toHaveBeenCalled()
 })
 it('blocks an additional movement during a pending save',()=>{
  show(true);expect(screen.getByRole('button',{name:'Mover Peça de teste'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Mover Peça de teste'}));expect(screen.queryByRole('region',{name:'Mover peça para outra etapa'})).toBeNull()
 })
})
describe('tablet layout detection',()=>{
 it('reacts to tablet or touch capability changes and cleans up',()=>{
  let update=()=>{};const remove=vi.fn()
  const media={matches:true,addEventListener:vi.fn((_,cb)=>{update=cb}),removeEventListener:remove}
  const match=vi.spyOn(window,'matchMedia').mockReturnValue(media as any)
  const {result,unmount}=renderHook(()=>useSocialTouchLayout())
  expect(match).toHaveBeenCalledWith(SOCIAL_TOUCH_QUERY);expect(result.current).toBe(true)
  act(()=>{media.matches=false;update()});expect(result.current).toBe(false)
  unmount();expect(remove).toHaveBeenCalledWith('change',update)
 })
})
