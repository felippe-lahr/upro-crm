// Avatar de pessoa da equipe: cor estável derivada do e-mail + iniciais.
const AVATAR_COLORS = ['#7c5cff', '#2f9e6b', '#d9772e', '#2563eb', '#c2417a', '#0e9aa7', '#8a6d1f']

export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initials(name: string | null | undefined, fallback: string): string {
  const parts = (name || fallback).trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
