'use client'

import { useEffect } from 'react'

/**
 * Captura o ?ref=CODIGO de um link de afiliado e guarda no localStorage,
 * para sobreviver à navegação até a página de cadastro.
 */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) localStorage.setItem('aff_ref', ref)
    } catch {}
  }, [])
  return null
}
