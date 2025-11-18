import { useEffect, useRef, useState } from 'react'
import Navbar from './Navbar'
import './Dashboard.css'
import {
  DEFAULT_MAP_CENTER,
  GOOGLE_MAPS_API_KEY,
  WATER_HIGHLIGHT_STYLES
} from '../constants/maps'
import { generateDiseaseAnalysis } from '../services/geminiService'

function Dashboard() {
  const [predictionData, setPredictionData] = useState({
    location: '',
    waterSource: 'tap',
    temperature: '',
    do: '',
    ph: '',
    conductivity: '',
    bod: '',
    nitrate: '',
    fecalColiform: '',
    totalColiform: ''
  })
  const [predictionResult, setPredictionResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mapStatus, setMapStatus] = useState('Loading map...')
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const userMarkerRef = useRef(null)
  const accuracyCircleRef = useRef(null)
  const waterMarkersRef = useRef([])
  const geoWatchIdRef = useRef(null)

  const clearWaterMarkers = () => {
    waterMarkersRef.current.forEach(marker => marker.setMap(null))
    waterMarkersRef.current = []
  }


  const highlightNearbyWaterBodies = (center) => {
    if (!window.google || !window.google.maps || !window.google.maps.places || !mapInstanceRef.current) {
      return
    }

    clearWaterMarkers()
    const service = new window.google.maps.places.PlacesService(mapInstanceRef.current)

    service.nearbySearch(
      {
        location: center,
        radius: 10000,
        type: ['natural_feature'],
        keyword: 'river lake water'
      },
      (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
          console.warn('Google Places water lookup failed:', status)
          return
        }

        results.slice(0, 15).forEach(place => {
          if (!place.geometry || !place.geometry.location) return
          const marker = new window.google.maps.Marker({
            position: place.geometry.location,
            map: mapInstanceRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#38bdf8',
              fillOpacity: 0.95,
              strokeColor: '#0f172a',
              strokeWeight: 1
            },
            title: place.name
          })

          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div class="water-infowindow">${place.name || 'Water body'}</div>`
          })

          marker.addListener('click', () => {
            infoWindow.open({
              anchor: marker,
              map: mapInstanceRef.current
            })
          })

          waterMarkersRef.current.push(marker)
        })

      }
    )
  }

  const openAshaReportWindow = () => {
    const baseUrl = window.location.origin
    const url = `${baseUrl}/asha-report`
    window.open(url, '_blank', 'noopener,noreferrer,width=900,height=800')
  }

  const showDefaultWaterBodies = (reason) => {
    if (!mapInstanceRef.current || !window.google?.maps) return
    const fallbackLatLng = new window.google.maps.LatLng(
      DEFAULT_MAP_CENTER.lat,
      DEFAULT_MAP_CENTER.lng
    )
    mapInstanceRef.current.setCenter(fallbackLatLng)
    mapInstanceRef.current.setZoom(10)
    const fallbackMessage = reason
      ? `${reason} Can't find locations; showing India map.`
      : "Can't find locations; showing India map."
    setMapStatus(fallbackMessage)
    highlightNearbyWaterBodies(DEFAULT_MAP_CENTER)
  }

  const logPositionDetails = (position) => {
    console.group('Geolocation Debug')
    console.log('Full position object:', position)
    console.log('Latitude:', position.coords.latitude)
    console.log('Longitude:', position.coords.longitude)
    console.log('Accuracy (meters):', position.coords.accuracy)
    console.log('Altitude:', position.coords.altitude)
    console.log('Altitude accuracy:', position.coords.altitudeAccuracy)
    console.log('Heading:', position.coords.heading)
    console.log('Speed:', position.coords.speed)
    console.log('Timestamp:', new Date(position.timestamp).toString())
    console.groupEnd()
  }

  const updateUserMarker = (coords, accuracy) => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const position = new window.google.maps.LatLng(coords.lat, coords.lng)

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(position)
    } else {
      userMarkerRef.current = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: 'You are here',
        label: {
          text: 'You',
          color: '#0f172a',
          fontSize: '12px',
          fontWeight: '600'
        }
      })
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = new window.google.maps.Circle({
        strokeColor: '#38bdf8',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: '#38bdf8',
        fillOpacity: 0.25,
        map: mapInstanceRef.current,
        center: position,
        radius: Math.max(accuracy, 20)
      })
    } else {
      accuracyCircleRef.current.setCenter(position)
      accuracyCircleRef.current.setRadius(Math.max(accuracy, 20))
    }
  }

  const clearGeolocationWatch = () => {
    if (geoWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current)
      geoWatchIdRef.current = null
    }
  }

  useEffect(() => {
    const mountMap = () => {
      if (!window.google || mapInstanceRef.current || !mapContainerRef.current) {
        return
      }

      // Initialize map in the dashboard.
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: DEFAULT_MAP_CENTER,
        zoom: 12,
        styles: WATER_HIGHLIGHT_STYLES,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true
      })

      const setStatusForCoords = (coords, accuracy) => {
        const accuracyText = accuracy
          ? `Accuracy ±${Math.round(accuracy)}m`
          : 'Accuracy unknown'
        setMapStatus(
          `Precise location locked at (${coords.lat.toFixed(
            4
          )}, ${coords.lng.toFixed(4)}). ${accuracyText}.`
        )
      }

      const handleAccuratePosition = (coords, accuracy) => {
        const latLng = new window.google.maps.LatLng(coords.lat, coords.lng)
        mapInstanceRef.current.setCenter(latLng)
        mapInstanceRef.current.setZoom(15)
        updateUserMarker(coords, accuracy || 30)
        setStatusForCoords(coords, accuracy)
        highlightNearbyWaterBodies(coords)
      }

      const isSecure =
        window.isSecureContext || window.location.hostname === 'localhost'

      if (!isSecure) {
        console.error(
          'Geolocation requires a secure context (https or localhost).'
        )
        showDefaultWaterBodies(
          'Browser blocked geolocation on insecure connection.'
        )
        return
      }

      // Prompt for current location via the Geolocation API.
      if ('geolocation' in navigator) {
        setMapStatus('Fetching your location…')
        navigator.geolocation.getCurrentPosition(
          (position) => {
            logPositionDetails(position)
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
            const accuracy = position.coords.accuracy

            handleAccuratePosition(coords, accuracy)

            // If browser reports low confidence, keep watching until we get ±40m or better
            if ((accuracy && accuracy > 40) || !accuracy) {
              setMapStatus(
                `Improving precision… current accuracy ±${Math.round(
                  accuracy || 100
                )}m`
              )
              geoWatchIdRef.current = navigator.geolocation.watchPosition(
                (watchPosition) => {
                  logPositionDetails(watchPosition)
                  const improvedCoords = {
                    lat: watchPosition.coords.latitude,
                    lng: watchPosition.coords.longitude
                  }
                  const improvedAccuracy = watchPosition.coords.accuracy

                  handleAccuratePosition(improvedCoords, improvedAccuracy)

                  if (improvedAccuracy && improvedAccuracy <= 40) {
                    clearGeolocationWatch()
                  }
                },
                (watchError) => {
                  console.warn('watchPosition failed', watchError)
                  clearGeolocationWatch()
                },
                {
                  enableHighAccuracy: true,
                  timeout: 15000,
                  maximumAge: 1000
                }
              )
            }
          },
          (error) => {
            console.error('Geolocation error:', error)
            let reason = 'Unable to access your location.'
            if (error?.code === error.PERMISSION_DENIED) {
              reason = 'Location permission denied.'
            } else if (error?.code === error.POSITION_UNAVAILABLE) {
              reason = 'Location unavailable from your device.'
            } else if (error?.code === error.TIMEOUT) {
              reason = 'Locating timed out.'
            }
            showDefaultWaterBodies(
              reason || "Can't find locations; showing India map."
            )
          },
          {
            enableHighAccuracy: true,
            timeout: 90000,
            maximumAge: 120000
          }
        )
      } else {
        alert('Geolocation not supported in this browser.')
        showDefaultWaterBodies('Geolocation not supported.')
      }
    }

    // Expose initMap globally so Google Maps can call it.
    window.initMap = mountMap

    // Re-use the script tag if it already exists.
    const existingScript = document.querySelector('script[data-google-maps]')
    if (window.google && window.google.maps) {
      mountMap()
    } else if (!existingScript) {
      if (GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY_HERE') {
        console.warn('Add your real Google Maps API key to VITE_GOOGLE_MAPS_API_KEY')
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=places`
      script.async = true
      script.defer = true
      script.dataset.googleMaps = 'true'
      script.onerror = () => {
        setMapStatus('Unable to load Google Maps. Please verify your API key.')
      }
      document.head.appendChild(script)
    }

    return () => {
      delete window.initMap
      clearWaterMarkers()
          clearGeolocationWatch()
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setMap(null)
          }
          if (userMarkerRef.current) {
            userMarkerRef.current.setMap(null)
          }
    }
      }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setPredictionData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePredict = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // Prepare data for ML model (matching the model's expected features)
      // Convert to numbers and validate
      const temp = parseFloat(predictionData.temperature)
      const do_val = parseFloat(predictionData.do)
      const ph_val = parseFloat(predictionData.ph)
      const cond = parseFloat(predictionData.conductivity)
      const bod = parseFloat(predictionData.bod)
      const nitrate = parseFloat(predictionData.nitrate)
      const fecal = parseFloat(predictionData.fecalColiform)
      const total = parseFloat(predictionData.totalColiform)
      
      // Validate all inputs are valid numbers
      if (isNaN(temp) || isNaN(do_val) || isNaN(ph_val) || isNaN(cond) || 
          isNaN(bod) || isNaN(nitrate) || isNaN(fecal) || isNaN(total)) {
        throw new Error('Please fill in all fields with valid numbers')
      }
      
      const mlInput = {
        Temp: temp,
        DO: do_val,
        pH: ph_val,
        Conductivity: cond,
        BOD: bod,
        Nitrate: nitrate,
        FecalColiform: fecal,
        TotalColiform: total
      }
      
      console.log('Sending prediction request:', mlInput)

      // Call the ML model API (FastAPI backend) with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mlInput),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error Response:', errorData)
        console.error('Response status:', response.status)
        
        // Handle 422 validation errors specifically
        if (response.status === 422) {
          const validationErrors = errorData.detail || errorData
          let errorMsg = 'Validation error: '
          if (Array.isArray(validationErrors)) {
            errorMsg += validationErrors.map(err => {
              const field = err.loc ? err.loc.join('.') : 'unknown'
              return `${field}: ${err.msg}`
            }).join(', ')
          } else if (typeof validationErrors === 'string') {
            errorMsg += validationErrors
          } else {
            errorMsg += JSON.stringify(validationErrors)
          }
          throw new Error(errorMsg)
        }
        
        throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`)
      }

      const result = await response.json()
      
      // Call Gemini API to generate diseases and recommendations
      let diseases = []
      let recommendations = []
      let geminiError = null
      
      try {
        const geminiData = await generateDiseaseAnalysis({
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          temperature: temp,
          do: do_val,
          ph: ph_val,
          conductivity: cond,
          bod: bod,
          nitrate: nitrate,
          fecalColiform: fecal,
          totalColiform: total,
          location: predictionData.location,
          waterSource: predictionData.waterSource
        })
        
        diseases = geminiData.diseases || []
        recommendations = geminiData.recommendations || []
        geminiError = geminiData.error || null
      } catch (geminiErr) {
        console.error('Gemini API error:', geminiErr)
        // Use fallback if Gemini fails
        diseases = getDiseasesForRisk(result.riskLevel)
        recommendations = getRecommendations(result.riskLevel)
        geminiError = geminiErr.message
      }
      
      setPredictionResult({
        riskScore: result.riskScore || 'N/A',
        riskLevel: result.riskLevel,
        diseases,
        recommendations,
        location: predictionData.location,
        waterSource: predictionData.waterSource,
        confidence: result.confidence,
        geminiError: geminiError // Store error but don't block results
      })
    } catch (error) {
      console.error('Prediction error:', error)
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      
      // Check if it's a network error
      let errorMessage = 'Failed to connect to ML API. '
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage += 'Request timed out. Please try again.'
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Network request failed')) {
        errorMessage += 'Please ensure the FastAPI backend is running on http://localhost:8000'
      } else if (error.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'Unknown error occurred. Check browser console for details.'
      }
      
      setPredictionResult({
        riskScore: null,
        riskLevel: null,
        diseases: [],
        recommendations: [],
        error: errorMessage
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getDiseasesForRisk = (riskLevel) => {
    if (riskLevel === 'High') {
      return ['Cholera', 'Typhoid', 'Dysentery', 'Hepatitis A']
    } else if (riskLevel === 'Medium') {
      return ['Gastroenteritis', 'Diarrhea']
    } else {
      return []
    }
  }

  const getRecommendations = (level) => {
    if (level === 'Low') {
      return [
        'Water quality is within safe parameters',
        'Continue regular monitoring',
        'Maintain current treatment protocols'
      ]
    } else if (level === 'Medium') {
      return [
        'Increase monitoring frequency',
        'Consider additional filtration',
        'Review treatment processes',
        'Notify health authorities'
      ]
    } else {
      return [
        'Immediate action required',
        'Issue public health advisory',
        'Implement emergency treatment',
        'Contact health department immediately',
        'Consider alternative water sources'
      ]
    }
  }

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <header className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">AWARE Dashboard</h1>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          <div className="dashboard-card map-card">
            <h2 className="card-title">Check Location</h2>
            <p className="map-description">
              Allow location access to find nearby rivers and water bodies.
            </p>
            <div
              id="map"
              ref={mapContainerRef}
              className="map-container"
              role="presentation"
              aria-label="Google Map showing your location and nearby water"
            ></div>
            {mapStatus && <p className="map-status">{mapStatus}</p>}
          </div>

          {/* Prediction Form */}
          <div className="dashboard-card prediction-card">
            <h2 className="card-title">Disease Risk Prediction</h2>
            <form onSubmit={handlePredict} className="prediction-form">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={predictionData.location}
                  onChange={handleInputChange}
                  placeholder="Enter location"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="waterSource">Water Source</label>
                <select
                  id="waterSource"
                  name="waterSource"
                  value={predictionData.waterSource}
                  onChange={handleInputChange}
                >
                  <option value="tap">Tap Water</option>
                  <option value="well">Well Water</option>
                  <option value="river">River</option>
                  <option value="lake">Lake</option>
                  <option value="reservoir">Reservoir</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="temperature">Temperature (°C)</label>
                  <input
                    type="number"
                    id="temperature"
                    name="temperature"
                    value={predictionData.temperature}
                    onChange={handleInputChange}
                    placeholder="25"
                    step="0.1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="do">Dissolved Oxygen (DO) (mg/L)</label>
                  <input
                    type="number"
                    id="do"
                    name="do"
                    value={predictionData.do}
                    onChange={handleInputChange}
                    placeholder="6.0"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ph">pH Level</label>
                  <input
                    type="number"
                    id="ph"
                    name="ph"
                    value={predictionData.ph}
                    onChange={handleInputChange}
                    placeholder="7.0"
                    min="0"
                    max="14"
                    step="0.1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="conductivity">Conductivity (µmhos/cm)</label>
                  <input
                    type="number"
                    id="conductivity"
                    name="conductivity"
                    value={predictionData.conductivity}
                    onChange={handleInputChange}
                    placeholder="200"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bod">BOD (mg/L)</label>
                  <input
                    type="number"
                    id="bod"
                    name="bod"
                    value={predictionData.bod}
                    onChange={handleInputChange}
                    placeholder="2.0"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nitrate">Nitrate (mg/L)</label>
                  <input
                    type="number"
                    id="nitrate"
                    name="nitrate"
                    value={predictionData.nitrate}
                    onChange={handleInputChange}
                    placeholder="0.5"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fecalColiform">Fecal Coliform (MPN/100ml)</label>
                  <input
                    type="number"
                    id="fecalColiform"
                    name="fecalColiform"
                    value={predictionData.fecalColiform}
                    onChange={handleInputChange}
                    placeholder="100"
                    step="1"
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="totalColiform">Total Coliform (MPN/100ml)</label>
                  <input
                    type="number"
                    id="totalColiform"
                    name="totalColiform"
                    value={predictionData.totalColiform}
                    onChange={handleInputChange}
                    placeholder="500"
                    step="1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="predict-button" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Analyzing...
                  </>
                ) : (
                  'Predict Risk'
                )}
              </button>
            </form>
          </div>

          {/* Prediction Results */}
          {predictionResult && (
            <div className="dashboard-card results-card">
              <h2 className="card-title">Prediction Results</h2>
              {predictionResult.error ? (
                <div className="error-banner">
                  <span className="error-icon">⚠️</span>
                  <p>{predictionResult.error}</p>
                  <p className="error-hint">Make sure to start the backend: <code>cd backend && python main.py</code></p>
                </div>
              ) : (
                <>
                  <div className={`risk-indicator risk-${predictionResult.riskLevel.toLowerCase()}`}>
                    <div className="risk-score">
                      <span className="score-value">{predictionResult.riskScore}%</span>
                      <span className="risk-level">{predictionResult.riskLevel} Risk</span>
                      {predictionResult.confidence && (
                        <span className="confidence-badge">Confidence: {predictionResult.confidence.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>

              {predictionResult.diseases.length > 0 && (
                <div className="diseases-section">
                  <h3>Potential Diseases</h3>
                  {predictionResult.geminiError && (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      ⚠️ Using fallback analysis (Gemini API unavailable)
                    </p>
                  )}
                  <div className="diseases-list">
                    {predictionResult.diseases.map((disease, idx) => (
                      <span key={idx} className="disease-tag">{disease}</span>
                    ))}
                  </div>
                </div>
              )}

                  <div className="recommendations-section">
                    <h3>Recommendations</h3>
                    {predictionResult.geminiError && (
                      <p style={{
                        marginBottom: '1rem',
                        padding: '0.5rem 0',
                        color: '#94a3b8',
                        fontSize: '0.9rem',
                        fontStyle: 'italic'
                      }}>
                        Advanced analysis unavailable, general tips:
                      </p>
                    )}
                    <div className="recommendations-grid">
                      {predictionResult.recommendations
                        .filter(rec => !rec.toLowerCase().includes('extended analysis unavailable') && !rec.toLowerCase().includes('advanced analysis unavailable'))
                        .map((rec, idx) => (
                        <div key={idx} className="recommendation-item">
                          <span className="recommendation-icon">✓</span>
                          <span className="recommendation-text">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="dashboard-card emergency-card">
            <h2 className="card-title">Quick Emergency Request</h2>
            <p className="emergency-description">
              Spot unusual water conditions? Submit an emergency request for officials to respond faster.
            </p>
            <button
              type="button"
              className="official-button"
              onClick={() => window.location.href = '/emergency-request'}
            >
              Go to Emergency Request Form
            </button>
          </div>

          {/* Stats Cards */}
          <div className="dashboard-card stats-card">
            <h2 className="card-title">Quick Stats</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">12</div>
                <div className="stat-label">Active Monitors</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">3</div>
                <div className="stat-label">Alerts Today</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">98.5%</div>
                <div className="stat-label">System Accuracy</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">24/7</div>
                <div className="stat-label">Monitoring</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="dashboard-card activity-card">
            <h2 className="card-title">Recent Activity</h2>
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon">🔍</div>
                <div className="activity-content">
                  <div className="activity-title">Risk assessment completed</div>
                  <div className="activity-time">2 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">📊</div>
                <div className="activity-content">
                  <div className="activity-title">Data updated for Location A</div>
                  <div className="activity-time">15 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">✅</div>
                <div className="activity-content">
                  <div className="activity-title">System health check passed</div>
                  <div className="activity-time">1 hour ago</div>
                </div>
              </div>
            </div>
          </div>

          {/* Water Quality Images Gallery */}
          <div className="dashboard-card images-card">
            <h2 className="card-title">Water Quality Examples</h2>
            <div className="images-grid">
              <div className="image-item">
                <img 
                  src="/drinking_water.jpg" 
                  alt="Clean drinking water" 
                  className="water-image"
                />
                <div className="image-label">Safe Drinking Water</div>
              </div>
              <div className="image-item">
                <img 
                  src="/lake_water.avif" 
                  alt="Lake water source" 
                  className="water-image"
                />
                <div className="image-label">Lake Water Source</div>
              </div>
              <div className="image-item">
                <img 
                  src="/water_bad.jpg" 
                  alt="Contaminated water" 
                  className="water-image"
                />
                <div className="image-label">Contaminated Water</div>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </>
  )
}

export default Dashboard

