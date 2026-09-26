import { useState } from 'react'
import { Play, ExternalLink, Video } from 'lucide-react'
import type { Asset } from '@/lib/social-board'

export function videoDuration(ms?:number) {
 if(!ms||!Number.isFinite(ms))return ''
 const seconds=Math.round(ms/1000)
 return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`
}
export function VideoCover({asset,preview}:{asset?:Asset;preview?:string}) {
 const [failed,setFailed]=useState(false)
 const duration=videoDuration(asset?.duration_ms)
 return <div className="relative h-40 bg-[#111318] overflow-hidden">
  {preview&&!failed?(asset?.thumbnail||asset?.type.startsWith('image/')?<img src={preview} alt={asset?.type.startsWith('video/')?`Prévia de ${asset.name}`:''} loading="lazy" onError={()=>setFailed(true)} className="w-full h-full object-contain"/>:<video src={`${preview}#t=0.1`} muted playsInline preload="metadata" onError={()=>setFailed(true)} className="w-full h-full object-contain"/>):<div className="h-full flex items-center justify-center"><Video className="h-8 w-8 text-white/50"/></div>}
  {asset?.type.startsWith('video/')&&<><span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full border border-white/40 bg-black/45 p-3 shadow-lg"><Play fill="currentColor" className="h-5 w-5 text-white"/></span></span><span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white">Vídeo{duration?` · ${duration}`:''}</span></>}
 </div>
}
export default function VideoPreview({asset}:{asset:Asset}) {
 const [playing,setPlaying]=useState(false)
 const [failed,setFailed]=useState(false)
 const isDrive=asset.storage==='drive'
 const embed=isDrive&&/^[A-Za-z0-9_-]+$/.test(asset.drive_id||'')?`https://drive.google.com/file/d/${asset.drive_id}/preview`:undefined
 if(!isDrive)return <video aria-label={`Prévia de ${asset.name}`} src={asset.url?`${asset.url}#t=0.1`:undefined} poster={asset.thumbnail?asset.preview:undefined} controls playsInline preload="metadata" className="w-full h-64 sm:h-80 bg-[#111318]"/>
 return <div className="bg-[#111318]">
  {playing&&embed?<iframe src={embed} title={`Reproduzir ${asset.name}`} allow="autoplay; fullscreen" allowFullScreen className="block w-full h-64 sm:h-80 border-0"/>:<button type="button" onClick={()=>setPlaying(true)} disabled={!embed} aria-label={`Reproduzir prévia de ${asset.name}`} className="group relative block w-full h-64 sm:h-80 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
   {asset.preview&&!failed?<img src={asset.preview} alt={`Prévia de ${asset.name}`} loading="lazy" onError={()=>setFailed(true)} className="w-full h-full object-contain"/>:<span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60"><Video className="h-10 w-10"/><span className="text-xs">Prévia em processamento</span></span>}
   <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full border border-white/60 bg-black/60 p-4 text-white shadow-xl transition-transform group-hover:scale-110"><Play fill="currentColor" className="h-6 w-6"/></span></span>
   <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pt-10 pb-3 px-3 flex items-center justify-between text-xs font-medium text-white"><span>Reproduzir vídeo</span><span>{videoDuration(asset.duration_ms)}</span></span>
  </button>}
  <div className="px-3 py-2 border-t border-white/10 space-y-1"><a href={asset.url} target="_blank" rel="noreferrer" className="text-[11px] text-white/80 hover:text-white inline-flex items-center gap-1">Abrir no Drive<ExternalLink className="h-3 w-3"/></a>{playing&&<p className="text-[10px] text-white/60">Use a conta Google com acesso ao arquivo se o player solicitar.</p>}{asset.folder_label&&<p className="text-[10px] text-white/50">{asset.folder_label}</p>}</div>
 </div>
}
