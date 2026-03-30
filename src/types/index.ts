export interface User {
  id: string
  name: string
  avatar?: string
}

export interface TravelRecord {
  id: string
  title: string
  description: string
  location: {
    lat: number
    lng: number
    name: string
  }
  photos: Photo[]
  timestamp: number
  tripId: string
}

export interface Photo {
  id: string
  url: string
  file?: File
  location?: {
    lat: number
    lng: number
  }
  timestamp: number
}

export interface Trip {
  id: string
  userId: string
  name: string
  startDate: number
  endDate?: number
  records: TravelRecord[]
}

export interface LocationSearchResult {
  placeId: string
  name: string
  address: string
  location: {
    lat: number
    lng: number
  }
}