// Centralize Google Maps configuration so the API key only lives in one place.
// Replace `YOUR_API_KEY_HERE` with a real key in your `.env` file later.
export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'

// Default fallback location (Chandigarh, India) shown when geolocation is unavailable.
export const DEFAULT_MAP_CENTER = { lat: 30.7333, lng: 76.7794 }

// Slightly highlight water while keeping the base map legible.
export const WATER_HIGHLIGHT_STYLES = [
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#1d4ed8' },
      { saturation: 40 },
      { lightness: -15 },
      { visibility: 'on' }
    ]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#e0f2fe' },
      { weight: 0.5 }
    ]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#0f172a' },
      { weight: 2 }
    ]
  },
  {
    featureType: 'road',
    stylers: [{ saturation: -20 }, { lightness: 10 }]
  },
  {
    featureType: 'landscape',
    stylers: [{ saturation: -10 }, { lightness: 5 }]
  },
  {
    featureType: 'poi',
    stylers: [{ saturation: -10 }]
  }
]

