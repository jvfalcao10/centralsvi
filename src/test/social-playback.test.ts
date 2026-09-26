import {beforeEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({eq:vi.fn(),drive:vi.fn()}))
vi.mock('../../api/_lib/supabase',()=>({createAdminClient:()=>({from:()=>({select:()=>({eq:mocks.eq})})})}))
vi.mock('../../api/_lib/social-drive',()=>({driveVideoRange:mocks.drive}))
import {videoRange,VIDEO_CHUNK,handleSocialPlayback} from '../../api/_lib/social-playback'
const token='b'.repeat(64),asset={id:'selected',type:'video/mp4',storage:'drive',drive_id:'driveID',bytes:100,name:'video.mp4'}
const card={id:'qa',assets:[asset,{...asset,id:'hidden'}],selected_assets:['selected'],token_expires_at:'2099-01-01T00:00:00Z'}
function response(){return {code:0,headers:{} as Record<string,string>,body:undefined as unknown,status(n:number){this.code=n;return this},setHeader(k:string,v:string){this.headers[k]=v;return this},send(body:unknown){this.body=body;return this},end(){return this}}}
beforeEach(()=>{vi.clearAllMocks();mocks.eq.mockReturnValue({maybeSingle:async()=>({data:card,error:null})});mocks.drive.mockResolvedValue({status:206,headers:new Headers({'content-range':'bytes 10-19/100'}),arrayBuffer:async()=>new Uint8Array(10).buffer,body:{cancel:vi.fn()}})})
describe('private video streaming',()=>{
 it('caps open-ended and explicit ranges below the function payload limit',()=>{expect(videoRange('bytes=0-',10000000)).toEqual({start:0,end:VIDEO_CHUNK-1});expect(videoRange('bytes=20-9999999',10000000)).toEqual({start:20,end:20+VIDEO_CHUNK-1})})
 it('handles seeking, final chunks and suffix ranges',()=>{expect(videoRange('bytes=90-',100)).toEqual({start:90,end:99});expect(videoRange('bytes=-15',100)).toEqual({start:85,end:99});expect(videoRange('bytes=10-19',100)).toEqual({start:10,end:19})})
 it.each(['bytes=100-','bytes=50-40','bytes=-0','bytes=0-1,3-4','invalid','bytes=9999999999999999999999-'])('rejects invalid or unsatisfiable ranges: %s',r=>expect(videoRange(r,100)).toBeNull())
 it('serves only the selected asset as a range, with no Google login redirect',async()=>{const r=response();await handleSocialPlayback({method:'GET',query:{token,asset:'selected'},headers:{range:'bytes=10-19'}} as never,r as never);expect(r.code).toBe(206);expect(r.headers['Content-Range']).toBe('bytes 10-19/100');expect(mocks.drive).toHaveBeenCalledWith('driveID',10,19);expect(r.headers.Location).toBeUndefined()})
 it('rejects access to another asset even with a valid piece token',async()=>{const r=response();await handleSocialPlayback({method:'GET',query:{token,asset:'hidden'},headers:{}} as never,r as never);expect(r.code).toBe(404);expect(mocks.drive).not.toHaveBeenCalled()})
 it.each([null,{...card,ingest_pending:true},{...card,token_expires_at:'2020-01-01'}])('rejects revoked, pending or expired links',async c=>{mocks.eq.mockReturnValue({maybeSingle:async()=>({data:c,error:null})});const r=response();await handleSocialPlayback({method:'GET',query:{token,asset:'selected'},headers:{}} as never,r as never);expect(r.code).toBe(404);expect(mocks.drive).not.toHaveBeenCalled()})
 it('does not accept a full upstream file in place of a bounded range',async()=>{const cancel=vi.fn();mocks.drive.mockResolvedValue({status:200,headers:new Headers(),body:{cancel}});const r=response();await handleSocialPlayback({method:'GET',query:{token,asset:'selected'},headers:{range:'bytes=10-19'}} as never,r as never);expect(r.code).toBe(502);expect(cancel).toHaveBeenCalled()})
 it('supports metadata requests without downloading the video',async()=>{const r=response();await handleSocialPlayback({method:'HEAD',query:{token,asset:'selected'},headers:{}} as never,r as never);expect(r.code).toBe(200);expect(r.headers['Content-Length']).toBe('100');expect(mocks.drive).not.toHaveBeenCalled()})
})
