import {useCallback,useRef} from 'react'

/**
 * Handler com identidade estável que sempre enxerga o estado mais recente.
 *
 * O quadro de peças tem 138 cards montados com drag and drop. Quando um handler
 * é recriado a cada render, `memo` no quadro não segura nada e digitar uma letra
 * na legenda re-renderiza os 138. Com isto a função nunca muda de identidade,
 * então o quadro só re-renderiza quando as peças mudam de verdade.
 */
export function useEvent<T extends (...args:never[])=>unknown>(fn:T):T {
 const ref=useRef(fn)
 ref.current=fn
 return useCallback(((...args:never[])=>ref.current(...args)) as T,[])
}
