import { useEffect, useState, useCallback } from 'react'
import {
  getFavorites,
  subscribeFavorites,
  toggleFavorite as toggle,
  isFavorite as check,
} from '../lib/favorites'
import type { Favorite } from '../types'

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>(() => getFavorites())

  useEffect(() => subscribeFavorites(setFavorites), [])

  const toggleFavorite = useCallback((fav: Favorite) => toggle(fav), [])
  const isFavorite = useCallback((id: string) => check(id), [favorites])

  return { favorites, toggleFavorite, isFavorite }
}
