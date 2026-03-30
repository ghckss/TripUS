import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

let mapsInstance: typeof google.maps | null = null

export async function initializeGoogleMaps(): Promise<typeof google.maps> {
  if (mapsInstance) {
    return mapsInstance
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('Google Maps API key is not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file.')
  }

  setOptions({ key: apiKey, v: 'weekly' })

  // 필요한 라이브러리를 모두 로드한 뒤 google.maps 반환
  await Promise.all([
    importLibrary('maps'),
    importLibrary('places'),
    importLibrary('geometry'),
    importLibrary('routes'),
  ])

  mapsInstance = google.maps
  return mapsInstance
}

export async function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  })
}
