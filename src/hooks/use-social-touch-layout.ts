import {useEffect,useState} from 'react'

// iPad can report a desktop viewport, including when a trackpad is connected.
export const SOCIAL_TOUCH_QUERY='(max-width: 1024px), (any-pointer: coarse)'
export function useSocialTouchLayout() {
 const [touch,setTouch]=useState(()=>window.matchMedia(SOCIAL_TOUCH_QUERY).matches)
 useEffect(()=>{
  const media=window.matchMedia(SOCIAL_TOUCH_QUERY)
  const update=()=>setTouch(media.matches)
  update();media.addEventListener('change',update)
  return()=>media.removeEventListener('change',update)
 },[])
 return touch
}
