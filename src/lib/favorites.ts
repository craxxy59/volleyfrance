import type { Favorite } from '../types'

const KEY = 'volleyfrance.favorites.v1'

type Listener = (favs: Favorite[]) => void

const listeners = new Set<Listener>()

function read(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(favs: Favorite[]) {
  localStorage.setItem(KEY, JSON.stringify(favs))
  listeners.forEach((l) => l(favs))
}

export function getFavorites(): Favorite[] {
  return read()
}

export function subscribeFavorites(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isFavorite(id: string): boolean {
  return read().some((f) => f.id === id)
}

export function toggleFavorite(fav: Favorite): boolean {
  const current = read()
  const exists = current.find((f) => f.id === fav.id)
  if (exists) {
    write(current.filter((f) => f.id !== fav.id))
    return false
  }
  write([fav, ...current])
  return true
}

export function removeFavorite(id: string) {
  write(read().filter((f) => f.id !== id))
}

export function teamFavId(team: string) {
  return `team:${team.trim().toUpperCase()}`
}

export function clubFavId(id: string) {
  return `club:${id}`
}

export function pouleFavId(codent: string, pouleCode: string) {
  return `poule:${codent}:${pouleCode}`
}
