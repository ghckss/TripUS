'use client'

import { useState, useEffect } from 'react'
import { initializeGoogleMaps } from '@/utils/maps'

export function useGoogleMaps() {
  const [maps, setMaps] = useState<typeof google.maps | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMaps = async () => {
      try {
        setLoading(true)
        setError(null)
        const mapsInstance = await initializeGoogleMaps()
        setMaps(mapsInstance)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Google Maps')
      } finally {
        setLoading(false)
      }
    }

    loadMaps()
  }, [])

  return { maps, loading, error }
}