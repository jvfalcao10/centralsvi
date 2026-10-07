import {randomBytes} from 'node:crypto'

/**
 * O código que vai no link de aprovação.
 *
 * Fica em módulo próprio, sem importar nada do projeto, porque tanto o link do
 * cliente quanto o link de peça precisam dele e os dois já se importam entre si:
 * deixar isto em qualquer um dos dois fecha um ciclo de importação.
 *
 * O alfabeto não tem 0/O nem 1/l/I: o link é lido em voz alta e digitado no
 * celular, e esses pares se confundem.
 */
const ALFABETO='23456789abcdefghjkmnpqrstuvwxyz'

export function codigoCurto(bytes=randomBytes(12)) {
 return Array.from(bytes).map(b=>ALFABETO[b%ALFABETO.length]).join('')
}

/**
 * Quem decide o que é código válido, para todo mundo.
 *
 * Estava repetida em quatro arquivos e, ao encurtar o código, duas cópias
 * ficaram para trás: o link novo era recusado antes mesmo de consultar o banco.
 * O código antigo, de 64 caracteres, continua valendo.
 */
export const formatoValido=(token:string)=>/^[a-f0-9]{64}$/.test(token)||new RegExp(`^[${ALFABETO}]{12}$`).test(token)
