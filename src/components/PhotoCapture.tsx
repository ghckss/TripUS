'use client'

import { useState, useRef } from 'react'
import { getCurrentLocation } from '@/utils/maps'
import { Photo } from '@/types'
import * as EXIF from 'exif-js'

interface PhotoCaptureProps {
  onPhotoCapture: (photo: Photo) => void
  disabled?: boolean
}

export function PhotoCapture({ onPhotoCapture, disabled = false }: PhotoCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPhoto = async (file: File): Promise<Photo> => {
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const photoUrl = URL.createObjectURL(file)

    let location: { lat: number; lng: number } | undefined

    try {
      const position = await getCurrentLocation()
      location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
    } catch (error) {
      console.warn('Could not get current location:', error)

      try {
        const exifLocation = await extractLocationFromEXIF(file)
        if (exifLocation) {
          location = exifLocation
        }
      } catch (exifError) {
        console.warn('Could not extract location from EXIF:', exifError)
      }
    }

    return {
      id: photoId,
      url: photoUrl,
      file,
      location,
      timestamp: Date.now(),
    }
  }

  const extractLocationFromEXIF = (file: File): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      EXIF.getData(file as any, function (this: any) {
        const lat = EXIF.getTag(this, 'GPSLatitude')
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef')
        const lon = EXIF.getTag(this, 'GPSLongitude')
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef')

        if (lat && lon && latRef && lonRef) {
          const latDecimal = convertDMSToDD(lat, latRef)
          const lonDecimal = convertDMSToDD(lon, lonRef)

          if (latDecimal !== null && lonDecimal !== null) {
            resolve({ lat: latDecimal, lng: lonDecimal })
            return
          }
        }

        resolve(null)
      })
    })
  }

  const convertDMSToDD = (dms: number[], ref: string): number | null => {
    if (!Array.isArray(dms) || dms.length !== 3) return null

    let dd = dms[0] + dms[1] / 60 + dms[2] / 3600
    if (ref === 'S' || ref === 'W') dd = dd * -1
    return dd
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return

    setIsCapturing(true)
    try {
      const photos = await Promise.all(files.map(f => processPhoto(f)))
      photos.forEach(photo => onPhotoCapture(photo))
    } catch (error) {
      console.error('Photo processing error:', error)
      alert('사진 처리 중 오류가 발생했습니다.')
    } finally {
      setIsCapturing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCaptureClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleCaptureClick}
        disabled={disabled || isCapturing}
        className="w-full flex items-center gap-3 px-4 py-3.5 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 active:border-orange-300 active:bg-orange-50/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isCapturing ? (
          <>
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-stone-200 border-t-orange-500" />
            </div>
            <span className="text-sm font-medium text-gray-500">사진 처리 중...</span>
          </>
        ) : (
          <>
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-stone-600 text-left">사진 추가</p>
              <p className="text-xs text-stone-400 text-left mt-0.5">촬영하거나 갤러리에서 선택</p>
            </div>
          </>
        )}
      </button>
    </div>
  )
}
