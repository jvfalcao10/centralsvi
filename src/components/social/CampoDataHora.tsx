import { useRef } from 'react'
import { CalendarClock } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Data e hora que abre o calendário no clique.
 *
 * João, 15/10/2026, com a gravação da tela: "melhor design na hora de
 * selecionar a data para programar post, dá bug e, em vez de abrir as datas,
 * faz ele selecionar para copiar e colar os números".
 *
 * Não era bug: é o `datetime-local` cru do navegador. Clicar no texto seleciona
 * o pedaço `dd` para digitar, e só o ícone minúsculo dentro do campo abre o
 * calendário. Aqui o campo inteiro é o botão do calendário, e o ícone fica
 * visível e do tamanho de um alvo de toque.
 */
export function CampoDataHora({ value, onChange, disabled, id }: {
 value: string
 onChange: (v: string) => void
 disabled?: boolean
 id?: string
}) {
 const campo = useRef<HTMLInputElement>(null)
 // showPicker só existe em navegador novo e só aceita gesto do usuário. Sem ele
 // o campo continua funcionando como antes, digitando.
 const abrir = () => {
  const el = campo.current
  if (!el || disabled) return
  try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.() } catch { /* o campo segue digitável */ }
 }
 return (
  <div className="relative mt-2">
   {/* Só no clique, nunca no foco: quem chega pelo teclado ou quer digitar a
       data na mão não pode ser interrompido por um calendário abrindo sozinho. */}
   <Input ref={campo} id={id} type="datetime-local" value={value} disabled={disabled}
     onChange={e => onChange(e.target.value)} onClick={abrir}
     className="h-12 cursor-pointer pr-12 text-base [&::-webkit-calendar-picker-indicator]:opacity-0"/>
   <button type="button" onClick={abrir} disabled={disabled} tabIndex={-1}
     aria-label="Abrir calendário"
     className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed">
    <CalendarClock className="h-5 w-5"/>
   </button>
  </div>
 )
}
