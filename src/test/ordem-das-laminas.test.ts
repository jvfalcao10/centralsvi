import { describe, it, expect } from 'vitest'
import { numeroDaLamina, ordemDasLaminas, publicationInput } from '../../api/_lib/social-publication-domain'
import { valeTentarDeNovo } from '../../api/_lib/social-publication-worker'
import { MetaPublicationError } from '../../api/_lib/social-publication-meta'

// João, 18/10/2026: "carrossel do Brenno saiu com slide fora de ordem e foi
// enviado no grupo". Naquele dia a conferência veio depois, com a peça já na
// mão do cliente. João, 20/10: "deve ser antes de publicar na verdade, né".
const arquivos = (...nomes: string[]) => nomes.map(name => ({ name }))

describe('o número que o nome dá para a lâmina', () => {
 it('lê o último número, que é a posição', () => {
  // Antes da posição vem cliente, versão e data, e todos têm número.
  expect(numeroDaLamina('DR-FELIPE-C6-39-anos-v2-lamina-07.jpg')).toBe(7)
  expect(numeroDaLamina('RAFAEL-k1-rev-03.jpg')).toBe(3)
  expect(numeroDaLamina('01.jpg')).toBe(1)
  expect(numeroDaLamina('[DRA ÉSIA] Arte A02 · 3 da manhã.png')).toBe(3)
 })
 it('arquivo sem número nenhum não finge posição', () => {
  expect(numeroDaLamina('capa final.jpg')).toBeNull()
 })
})

describe('carrossel fora de ordem não sai', () => {
 it('deixa passar o que está na sequência', () => {
  expect(ordemDasLaminas(arquivos('RAFAEL-k1-rev-01.jpg','RAFAEL-k1-rev-02.jpg','RAFAEL-k1-rev-03.jpg'))).toBe('')
  expect(ordemDasLaminas(arquivos(...Array.from({length:10},(_,i)=>`DR-FELIPE-C6-39-anos-v2-lamina-${String(i+1).padStart(2,'0')}.jpg`)))).toBe('')
 })

 it('segura e diz qual lâmina está no lugar errado', () => {
  const erro = ordemDasLaminas(arquivos('b-lamina-01.jpg','b-lamina-03.jpg','b-lamina-02.jpg'))
  expect(erro).toContain('fora da ordem')
  expect(erro).toContain('lâmina 2')
  expect(erro).toContain('posição 3')
 })

 // Salto de número é legítimo: lâmina reprovada sai da seleção e o resto segue.
 it('buraco na numeração não é erro, desde que cresça', () => {
  expect(ordemDasLaminas(arquivos('a-01.jpg','a-04.jpg','a-09.jpg'))).toBe('')
 })

 it('não cobra ordem de quem não tem número, nem de nome repetido', () => {
  expect(ordemDasLaminas(arquivos('capa.jpg','a-02.jpg'))).toBe('')
  expect(ordemDasLaminas(arquivos('a-02.jpg','b-02.jpg'))).toBe('')
 })
})

describe('a trava fecha os dois caminhos até o Instagram', () => {
 const ator='11111111-1111-4111-8111-111111111111'
 const conta={id:'123',username:'cliente',name:'Cliente'}
 const lamina=(id:string,name:string)=>({id,name,type:'image/jpeg',path:name})
 const card:any={id:'qa',client:'Cliente',title:'Peça',stage:'aprovado',version:1,revision:1,caption:'Legenda',
  assets:[lamina('a','b-lamina-01.jpg'),lamina('b','b-lamina-02.jpg'),lamina('c','b-lamina-03.jpg')],
  selected_assets:['a','c','b']}
 const body={confirmed:true,request_id:'22222222-2222-4222-8222-222222222222',account_id:'123',format:'carousel',when:'now'}

 it('a tela recusa antes de criar qualquer coisa no Instagram', () => {
  expect(()=>publicationInput(card,body,[conta],ator)).toThrow('fora da ordem')
 })

 it('marcado na ordem certa, passa', () => {
  const certo={...card,selected_assets:['a','b','c']}
  expect(publicationInput(certo,body,[conta],ator).assets.map(a=>a.name)).toEqual(['b-lamina-01.jpg','b-lamina-02.jpg','b-lamina-03.jpg'])
 })

 // Carrossel fora de ordem não é soluço de rede: tentar de novo repete o erro.
 it('a falha do operário não vira nova tentativa', () => {
  expect(valeTentarDeNovo(new MetaPublicationError(0,ordemDasLaminas([{name:'a-02.jpg'},{name:'a-01.jpg'}])))).toBe(false)
 })
})
