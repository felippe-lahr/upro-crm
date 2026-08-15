/**
 * Marcador de origem de anúncio embutido de forma INVISÍVEL na mensagem do
 * WhatsApp, usando caracteres de largura zero (zero-width). O cliente vê apenas
 * a frase natural; o CRM decodifica o código para casar com o AdClick.
 *
 * Bits: U+200B = 0, U+200C = 1. Cada caractere do código (a-z0-9) vira 7 bits.
 * A leitura extrai só os zero-width da mensagem, então funciona mesmo que o
 * marcador fique no meio do texto.
 */
const ZERO = '​' // zero-width space      -> bit 0
const ONE = '‌'  // zero-width non-joiner -> bit 1

export function encodeAdMarker(code: string): string {
  let bits = ''
  for (const ch of code) bits += ch.charCodeAt(0).toString(2).padStart(7, '0')
  let out = ''
  for (const b of bits) out += b === '1' ? ONE : ZERO
  return out
}

export function decodeAdMarker(text: string): string | null {
  const zw = (text || '').match(/[​‌]/g)
  if (!zw || zw.length < 7 || zw.length % 7 !== 0) return null
  const bits = zw.map((c) => (c === ONE ? '1' : '0')).join('')
  let out = ''
  for (let i = 0; i < bits.length; i += 7) {
    const code = parseInt(bits.slice(i, i + 7), 2)
    if (code < 32 || code > 126) return null
    out += String.fromCharCode(code)
  }
  return /^[a-z0-9]+$/.test(out) ? out : null
}

/** Insere o marcador invisível logo após o 1o caractere (evita ser aparado nas pontas). */
export function embedAdMarker(text: string, code: string): string {
  const marker = encodeAdMarker(code)
  if (!text) return marker
  return text.slice(0, 1) + marker + text.slice(1)
}
