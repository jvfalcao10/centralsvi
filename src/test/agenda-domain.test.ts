import {describe,it,expect} from 'vitest'
import {deBrasilia,emBrasilia,horariosLivres,porDia,horarioValido,dadosDaReuniao,vitrineDoDia,lerVitrine,VITRINE_PADRAO} from '../../api/_lib/agenda-domain'

// 2026 começa numa quinta. 12/10/2026 é uma segunda-feira.
const SEG=Date.UTC(2026,9,12) // 12/10/2026
const seg9=deBrasilia(2026,10,12,9,0)

describe('hora de Brasília',()=>{
 it('converte 9h de Brasília para 12h UTC',()=>{
  expect(new Date(seg9).toISOString()).toBe('2026-10-12T12:00:00.000Z')
 })
 it('volta a mesma hora de parede',()=>{
  const p=emBrasilia(seg9)
  expect([p.ano,p.mes,p.dia,p.hora,p.minuto]).toEqual([2026,10,12,9,0])
  expect(p.semana).toBe(1)
 })
})

describe('horários oferecidos',()=>{
 const livres=(extra:Partial<Parameters<typeof horariosLivres>[0]>={})=>
  horariosLivres({agora:deBrasilia(2026,10,9,8,0),ocupados:[],dias:7,...extra})

 it('o dia inteiro tem 18 encaixes, das 9h às 17h30',()=>{
  const doDia=livres().filter(t=>new Date(t).toISOString().startsWith('2026-10-12'))
  expect(doDia).toHaveLength(18)
 })

 it('abre às 9h e o último começa 17h30',()=>{
  const dia=porDia(livres()).find(d=>d.dia==='2026-10-12')!
  expect(dia.horarios[0].hora).toBe('09:00')
  expect(dia.horarios.at(-1)!.hora).toBe('17:30')
 })

 it('não oferece sábado nem domingo',()=>{
  const dias=porDia(livres()).map(d=>d.dia)
  expect(dias).not.toContain('2026-10-10')
  expect(dias).not.toContain('2026-10-11')
 })

 it('pula o que já está ocupado na agenda, inclusive sobreposição parcial',()=>{
  const ocupados=[{inicio:deBrasilia(2026,10,12,10,15),fim:deBrasilia(2026,10,12,11,0)}]
  // Medido na lista completa, não na vitrine: aqui o que importa é a REGRA de
  // disponibilidade, não quantos horários a tela resolve mostrar. Folga zero
  // porque o respiro em volta do compromisso tem teste próprio.
  const horas=livres({ocupados,folgaMin:0})
   .filter(t=>new Date(t).toISOString().startsWith('2026-10-12'))
   .map(t=>{const p=emBrasilia(t);return `${String(p.hora).padStart(2,'0')}:${String(p.minuto).padStart(2,'0')}`})
  // 10:00-10:30 e 10:30-11:00 encostam no compromisso e saem
  expect(horas).not.toContain('10:00')
  expect(horas).not.toContain('10:30')
  expect(horas).toContain('09:30')
  expect(horas).toContain('11:00')
 })

 it('não oferece horário colado na hora atual',()=>{
  const agora=deBrasilia(2026,10,12,9,10)
  const horas=porDia(horariosLivres({agora,ocupados:[],dias:1})).find(d=>d.dia==='2026-10-12')?.horarios.map(h=>h.hora)||[]
  expect(horas).not.toContain('09:30')
  expect(horas).not.toContain('10:30')
  expect(horas[0]).toBe('11:30')
 })

 it('só aceita marcar um horário que a própria regra ofereceria',()=>{
  const lista=livres()
  expect(horarioValido(new Date(seg9).toISOString(),lista)).toBe(seg9)
  // 8h30 está fora do expediente e não pode entrar por fora da tela
  expect(horarioValido(new Date(deBrasilia(2026,10,12,8,30)).toISOString(),lista)).toBeNull()
  expect(horarioValido('qualquer coisa',lista)).toBeNull()
 })
})

describe('dados de quem marca',()=>{
 const base={nome:'João Vitor Falcão',email:'joao@svicompany.com.br',whatsapp:'(94) 99999-8888',assunto:'tráfego'}
 it('aceita e normaliza o WhatsApp com 55',()=>{
  expect(dadosDaReuniao(base)).toMatchObject({whatsapp:'5594999998888',nome:'João Vitor Falcão'})
 })
 it('não duplica o 55 de quem já mandou completo',()=>{
  expect(dadosDaReuniao({...base,whatsapp:'5594999998888'})).toMatchObject({whatsapp:'5594999998888'})
 })
 it('recusa e-mail pela metade e nome curto',()=>{
  expect(dadosDaReuniao({...base,email:'joao@svicompany'}).erro).toBeTruthy()
  expect(dadosDaReuniao({...base,nome:'Jo'}).erro).toBeTruthy()
  expect(dadosDaReuniao({...base,whatsapp:'123'}).erro).toBeTruthy()
 })
})

// João, 09/10: pediu limitar ("pra não falar que somos à toa") e, vendo o
// resultado, preferiu mostrar todos. Virou chave de operação, desligada por
// padrão, e os testes cobrem os dois estados.
describe('vitrine de horários',()=>{
 const cheio=Array.from({length:18},(_,i)=>i)

 it('por padrão não esconde nada',()=>{
  expect(porDia(horariosLivres({agora:deBrasilia(2026,10,9,8,0),ocupados:[],dias:7}))
   .find(d=>d.dia==='2026-10-12')!.horarios).toHaveLength(18)
 })

 it('a chave aceita lista e ignora lixo',()=>{
  expect(lerVitrine('2,4,5,7')).toEqual([2,4,5,7])
  expect(lerVitrine('')).toEqual([])
  expect(lerVitrine(undefined)).toEqual([])
  expect(lerVitrine('abc, 0, -3, 99, 5')).toEqual([5])
 })

 it('ligada, mostra no máximo o que a chave define',()=>{
  for(const chave of ['2026-10-12','2026-10-13','2026-10-14','2026-11-03'])
   expect(VITRINE_PADRAO).toContain(vitrineDoDia(cheio,chave,VITRINE_PADRAO).length)
 })

 it('não muda entre visitas do mesmo dia',()=>{
  expect(vitrineDoDia(cheio,'2026-10-12',VITRINE_PADRAO)).toEqual(vitrineDoDia(cheio,'2026-10-12',VITRINE_PADRAO))
 })

 it('espalha pelo dia e mantém o primeiro e o último',()=>{
  const v=vitrineDoDia(cheio,'2026-10-12',VITRINE_PADRAO)
  expect(v[0]).toBe(0)
  expect(v.at(-1)).toBe(17)
  // sem repetir e em ordem
  expect([...v].sort((a,b)=>a-b)).toEqual(v)
  expect(new Set(v).size).toBe(v.length)
 })

 it('dia com poucas vagas aparece inteiro',()=>{
  expect(vitrineDoDia([1,2],'2026-10-12',VITRINE_PADRAO)).toEqual([1,2])
 })

 it('esconder não é bloquear: horário fora da vitrine continua podendo ser marcado',()=>{
  const lista=horariosLivres({agora:deBrasilia(2026,10,9,8,0),ocupados:[],dias:7})
  const mostrados=new Set(porDia(lista,VITRINE_PADRAO).flatMap(d=>d.horarios.map(h=>Date.parse(h.inicio))))
  const escondido=lista.find(t=>!mostrados.has(t))!
  expect(escondido).toBeDefined()
  expect(horarioValido(new Date(escondido).toISOString(),lista)).toBe(escondido)
 })
})

// João, 09/10: "15h tem gravação, não pode pôr 14h30". Reunião que termina no
// minuto em que a gravação começa não é horário livre, é armadilha.
describe('folga em volta dos compromissos',()=>{
 const horas=(ocupados:{inicio:number;fim:number}[],folgaMin?:number)=>
  horariosLivres({agora:deBrasilia(2026,10,9,8,0),ocupados,dias:7,folgaMin})
   .filter(t=>new Date(t).toISOString().startsWith('2026-10-12'))
   .map(t=>{const p=emBrasilia(t);return `${String(p.hora).padStart(2,'0')}:${String(p.minuto).padStart(2,'0')}`})

 const gravacao=[{inicio:deBrasilia(2026,10,12,15,0),fim:deBrasilia(2026,10,12,16,0)}]

 it('não oferece o horário que termina colado na gravação',()=>{
  const h=horas(gravacao)
  expect(h).not.toContain('14:30')
  expect(h).not.toContain('15:00')
  expect(h).not.toContain('15:30')
 })

 it('deixa respiro também na saída da gravação',()=>{
  const h=horas(gravacao)
  expect(h).not.toContain('16:00')
  expect(h).toContain('16:30')
 })

 it('o que está a meia hora de distância continua valendo',()=>{
  expect(horas(gravacao)).toContain('14:00')
 })

 it('folga zero volta ao encaixe colado',()=>{
  const h=horas(gravacao,0)
  expect(h).toContain('14:30')
  expect(h).toContain('16:00')
 })
})

// GPT, revisão de 09/10: datas compactas na fita de dias, por extenso só na
// confirmação, onde a pessoa precisa ler o dia antes de confirmar.
describe('rótulos de dia',()=>{
 const dia=()=>porDia(horariosLivres({agora:deBrasilia(2026,10,9,8,0),ocupados:[],dias:7}))
  .find(d=>d.dia==='2026-10-12')!
 it('tem versão curta para a fita e longa para a confirmação',()=>{
  expect(dia().curto).toBe('SEG · 12 OUT')
  expect(dia().rotulo).toBe('segunda, 12 de out')
 })
})
