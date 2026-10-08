import {describe,it,expect} from 'vitest'
import {grupoDoCliente} from '../../api/_lib/social-client-approval'

// João, 08/10: botão que manda a peça pro cliente aprovar pela Sofia. O nome no
// quadro não é igual ao do grupo ("DRA. ÉSIA LOPES" contra "Dra. Ésia"), então a
// ligação é pelos apelidos que já servem para reconhecer a peça.
describe('o grupo de WhatsApp do cliente',()=>{
 it('acha o grupo mesmo com o nome escrito diferente',()=>{
  expect(grupoDoCliente('DRA. ÉSIA LOPES')?.nome).toBe('Dra. Ésia')
  expect(grupoDoCliente('ESPAÇO SORAIA')?.nome).toBe('Espaço Soraia')
  expect(grupoDoCliente('COLÉGIO CHRISTO REI')?.nome).toBe('Colégio Christo Rei')
  expect(grupoDoCliente('DR. FELIPE BRANCO')?.nome).toBe('Dr. Felipe Branco')
 })
 // Mandar material para o cliente errado não tem volta.
 it('não devolve nada quando não tem certeza',()=>{
  expect(grupoDoCliente('Identificar cliente')).toBeNull()
  expect(grupoDoCliente('Cliente Que Nao Existe')).toBeNull()
  expect(grupoDoCliente('')).toBeNull()
  expect(grupoDoCliente('ab')).toBeNull()
 })
 it('devolve o endereço do grupo, não só o nome',()=>{
  const g=grupoDoCliente('ALPHA FITNESS')
  expect(g?.jid).toMatch(/@g\.us$/)
 })
})
