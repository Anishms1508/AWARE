import { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './Navbar'
import './OfficialDashboard.css'
import { fetchAshaReports, fetchEmergencyReports, deleteAshaReport, deleteEmergencyReport } from '../services/reportService'
import { startSensors, stopSensors, getSensorStatus, startLiveGraph, stopLiveGraph, getGraphStatus, getSensorData, predictWaterQuality, getGraphImageUrl } from '../services/sensorService'
import { jsPDF } from 'jspdf'

const DEFAULT_CENTER = { lat: 30.7333, lng: 76.7794 }

const loadGoogleMaps = () =>
  new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps)
      return
    }

    const existing = document.querySelector('script[data-official-map]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps))
      existing.addEventListener('error', reject)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=visualization`
    script.async = true
    script.defer = true
    script.dataset.officialMap = 'true'
    script.onload = () => resolve(window.google.maps)
    script.onerror = reject
    document.head.appendChild(script)
  })

const riskPalette = {
  Low: '#22c55e',
  Medium: '#facc15',
  High: '#ef4444'
}

const computeRiskLevel = (report) => {
  let score = 0
  const symptoms = (report.mainSymptoms || []).map(s => s.toLowerCase())

  if (symptoms.some(s => ['diarrhoea', 'vomiting'].includes(s))) score += 2
  if (symptoms.includes('fever')) score += 1
  if (report.waterDirty === 'yes') score += 2
  if (report.flooding === 'yes') score += 1
  if (Number(report.peopleCount || 0) >= 20) score += 2
  else if (Number(report.peopleCount || 0) >= 10) score += 1

  if (score >= 5) return 'High'
  if (score >= 3) return 'Medium'
  return 'Low'
}

function OfficialDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [reports, setReports] = useState([])
  const [emergencyReports, setEmergencyReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [reportIndex, setReportIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [emergencyPreviewUrl, setEmergencyPreviewUrl] = useState('')
  const [deletingReportId, setDeletingReportId] = useState(null)
  const [deletingEmergencyId, setDeletingEmergencyId] = useState(null)
  const [summary, setSummary] = useState({
    newReports: 0,
    highRisk: 0,
    emergencyCount: 0,
    topArea: '-'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sensorsRunning, setSensorsRunning] = useState(false)
  const [graphRunning, setGraphRunning] = useState(false)
  const [graphImageUrl, setGraphImageUrl] = useState('')
  const [mlPredictionData, setMlPredictionData] = useState({
    Temp: '',
    DO: '',
    pH: '',
    Conductivity: '',
    BOD: '',
    Nitrate: '',
    FecalColiform: '',
    TotalColiform: ''
  })
  const [mlPredictionResult, setMlPredictionResult] = useState(null)
  const [mlLoading, setMlLoading] = useState(false)
  const [sensorData, setSensorData] = useState([])
  const [showSidebar, setShowSidebar] = useState(true)

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const mapMarkers = useRef([])

  const OFFICIAL_CREDENTIALS = useMemo(
    () => ({ username: 'user', password: '12345' }),
    []
  )

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const fetched = await fetchAshaReports()
        const mapped = fetched.map(report => ({
          ...report,
          risk: computeRiskLevel(report)
        }))
        const emergencies = await fetchEmergencyReports()
        setReports(mapped)
        setEmergencyReports(emergencies)
        computeSummary(mapped, emergencies)
        initMap(mapped)
      } catch (err) {
        console.error(err)
        setError('Failed to load reports.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated])

  // Check sensor and graph status on mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return

    const checkStatus = async () => {
      try {
        const sensorStatus = await getSensorStatus()
        const graphStatus = await getGraphStatus()
        setSensorsRunning(sensorStatus.running)
        setGraphRunning(graphStatus.running)
      } catch (err) {
        console.error('Error checking status:', err)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Fetch sensor data periodically when sensors are running
  useEffect(() => {
    if (!isAuthenticated || !sensorsRunning) {
      setSensorData([]) // Clear data when sensors stop
      return
    }

    const fetchSensorData = async () => {
      try {
        const data = await getSensorData()
        setSensorData(data.data || [])
      } catch (err) {
        console.error('Error fetching sensor data:', err)
      }
    }

    // Fetch immediately when sensors start
    fetchSensorData()
    // Then fetch every 5 seconds (matching sensor update interval)
    const interval = setInterval(fetchSensorData, 5000)
    return () => clearInterval(interval)
  }, [isAuthenticated, sensorsRunning])

  // Refresh graph image when graph is running
  useEffect(() => {
    if (!isAuthenticated || !graphRunning) {
      setGraphImageUrl('')
      return
    }

    const updateGraphImage = () => {
      // Update image URL with timestamp to force refresh
      setGraphImageUrl(getGraphImageUrl())
    }

    // Update immediately and then every 2 seconds
    updateGraphImage()
    const interval = setInterval(updateGraphImage, 2000)
    return () => clearInterval(interval)
  }, [isAuthenticated, graphRunning])

  useEffect(() => {
    setReportIndex(0)
  }, [reports.length])

  const computeSummary = (reportsData, emergencyData = emergencyReports) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const newReports = reportsData.filter(report => {
      if (!report.submittedAt) return false
      return new Date(report.submittedAt) >= todayStart
    }).length

    const highRisk = reportsData.filter(report => report.risk === 'High').length

    const areaCounts = reportsData.reduce((acc, report) => {
      const key = report.villageName || 'Unknown'
      acc[key] = (acc[key] || 0) + Number(report.peopleCount || 0)
      return acc
    }, {})
    const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    setSummary({
      newReports,
      highRisk,
      emergencyCount: emergencyData.length,
      topArea
    })
  }

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  const buildReportPdf = (report) => {
    const doc = new jsPDF()
    const margin = 14
    let y = 25
    doc.setFillColor(16, 25, 46)
    doc.rect(0, 0, 220, 45, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.text(report.villageName || 'ASHA Report', margin, 25)
    doc.setFontSize(12)
    doc.text(`Date: ${formatDateOnly(report.submittedAt)}`, margin, 36)
    doc.setTextColor(33, 33, 33)
    y = 60

    const sections = [
      {
        title: 'Reporter Details',
        fields: [
          ['ASHA Name', report.ashaName || '-'],
          ['Village / Locality', report.villageName || '-'],
        ]
      },
      {
        title: 'Health Snapshot',
        fields: [
          ['People Sick', report.peopleCount || '-'],
          ['Days Since Onset', report.daysSinceOnset || '-'],
          ['Age Group', report.ageGroup || '-'],
          ['Symptoms', Array.isArray(report.mainSymptoms) ? report.mainSymptoms.join(', ') : '-']
        ]
      },
      {
        title: 'Water & Environment',
        fields: [
          ['Water Source', report.waterSource || '-'],
          ['Water Dirty?', report.waterDirty === 'yes' ? 'Yes' : 'No'],
          ['Recent Flooding?', report.flooding === 'yes' ? 'Yes' : 'No']
        ]
      },
      {
        title: 'Location',
        fields: [
          ['Latitude', report.latitude || '-'],
          ['Longitude', report.longitude || '-']
        ]
      }
    ]

    doc.setFontSize(14)
    sections.forEach(section => {
      doc.setFont(undefined, 'bold')
      doc.text(section.title, margin, y)
      doc.setFontSize(11)
      doc.setFont(undefined, 'normal')
      y += 8
      section.fields.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`, margin, y)
        y += 6
        if (y > 270) {
          doc.addPage()
          y = 20
        }
      })
      y += 4
      doc.setLineWidth(0.1)
      doc.line(margin, y, 200, y)
      y += 7
    })

    if (report.notes) {
      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Notes / Observations', margin, y)
      doc.setFontSize(11)
      doc.setFont(undefined, 'normal')
      const wrapped = doc.splitTextToSize(report.notes, 180)
      doc.text(wrapped, margin, y + 8)
    }
    return doc
  }

  const handleDownloadReport = (report) => {
    const doc = buildReportPdf(report)
    const fileName = `report-${report.id || report.villageName || 'asha'}.pdf`
    doc.save(fileName)
  }

  const handleViewReport = (report) => {
    const doc = buildReportPdf(report)
    const url = doc.output('bloburl')
    setPreviewUrl(url)
    setSelectedReport(report)
  }

  const buildEmergencyPdf = (report) => {
    const doc = new jsPDF()
    const margin = 14
    doc.setFontSize(20)
    doc.text('Emergency Waterbody Report', margin, 25)
    doc.setFontSize(12)
    doc.text(`Submitted: ${formatDateOnly(report.submittedAt)}`, margin, 34)
    doc.text(`Reporter Aadhaar: ${report.aadhar || '-'}`, margin, 42)
    doc.setFontSize(11)
    let y = 58
    const fields = [
      ['Water Body Name', report.waterBodyName || '-'],
      ['Location', report.location || '-'],
      ['Concern Details', report.concern || '-']
    ]
    fields.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold')
      doc.text(`${label}:`, margin, y)
      doc.setFont(undefined, 'normal')
      const lines = doc.splitTextToSize(value, 180)
      doc.text(lines, margin + 2, y + 6)
      y += 6 + lines.length * 6 + 4
      if (y > 270) {
        doc.addPage()
        y = 20
      }
    })
    return doc
  }

  const handleViewEmergency = (report) => {
    const doc = buildEmergencyPdf(report)
    const url = doc.output('bloburl')
    setEmergencyPreviewUrl(url)
    setSelectedEmergency(report)
  }

  const handleDownloadEmergency = (report) => {
    const doc = buildEmergencyPdf(report)
    const fileName = `emergency-${report.id || report.waterBodyName || 'request'}.pdf`
    doc.save(fileName)
  }

  const handleDeleteReport = async (report) => {
    if (!report?.id) return
    const confirmDelete = window.confirm('Delete this report permanently?')
    if (!confirmDelete) return
    try {
      setDeletingReportId(report.id)
      setError('')
      await deleteAshaReport(report.id)
      setReports(prev => {
        const updated = prev.filter(item => item.id !== report.id)
        computeSummary(updated, emergencyReports)
        initMap(updated)
        setReportIndex(prevIndex => {
          if (!updated.length) return 0
          return Math.min(prevIndex, updated.length - 1)
        })
        if (selectedReport?.id === report.id) {
          setSelectedReport(null)
          setPreviewUrl('')
        }
        return updated
      })
    } catch (err) {
      console.error('Delete error:', err)
      const errorMessage = err?.message || 'Failed to delete report. Please check your Firestore permissions.'
      setError(errorMessage)
      alert(`Error: ${errorMessage}`)
    } finally {
      setDeletingReportId(null)
    }
  }

  useEffect(() => {
    setReportIndex(0)
  }, [reports.length])

  const initMap = async (data) => {
    try {
      const maps = await loadGoogleMaps()
      if (!mapRef.current) return

      if (!mapInstance.current) {
        mapInstance.current = new maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: 6,
          streetViewControl: false,
          mapTypeControl: false
        })
      }

      // Clear existing markers
      mapMarkers.current.forEach(marker => marker.setMap(null))
      mapMarkers.current = []

      const markers = data
        .filter(report => report.latitude && report.longitude)
        .map(report => {
          const marker = new maps.Marker({
            position: { lat: Number(report.latitude), lng: Number(report.longitude) },
            map: mapInstance.current,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: riskPalette[report.risk],
              fillOpacity: 0.9,
              strokeColor: '#0f172a',
              strokeWeight: 2
            }
          })
          marker.addListener('click', () => setSelectedReport(report))
          return marker
        })

      mapMarkers.current = markers

      if (markers.length) {
        const bounds = new maps.LatLngBounds()
        markers.forEach(marker => bounds.extend(marker.getPosition()))
        mapInstance.current.fitBounds(bounds)
      }
    } catch (err) {
      console.error('Failed to initialize map', err)
      setError('Unable to load map. Please check your API key.')
    }
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (
      login.username.trim() === OFFICIAL_CREDENTIALS.username &&
      login.password === OFFICIAL_CREDENTIALS.password
    ) {
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Invalid credentials for officials.')
    }
  }

  const pageClass = isAuthenticated ? 'official-page' : 'official-page login-state'
  const currentReport = reports[reportIndex] || null

  const handlePrevReport = () => {
    setReportIndex(prev => (reports.length ? (prev - 1 + reports.length) % reports.length : 0))
  }

  const handleNextReport = () => {
    setReportIndex(prev => (reports.length ? (prev + 1) % reports.length : 0))
  }

  const handleDeleteEmergency = async (report) => {
    if (!report?.id) return
    const confirmDelete = window.confirm('Delete this emergency request permanently?')
    if (!confirmDelete) return
    try {
      setDeletingEmergencyId(report.id)
      setError('')
      await deleteEmergencyReport(report.id)
      setEmergencyReports(prev => {
        const updated = prev.filter(item => item.id !== report.id)
        if (selectedEmergency?.id === report.id) {
          setSelectedEmergency(null)
          setEmergencyPreviewUrl('')
        }
        computeSummary(reports, updated)
        return updated
      })
    } catch (err) {
      console.error('Delete error:', err)
      const errorMessage = err?.message || 'Failed to delete emergency request. Please check your Firestore permissions.'
      setError(errorMessage)
      alert(`Error: ${errorMessage}`)
    } finally {
      setDeletingEmergencyId(null)
    }
  }

  // Sensor and graph control handlers
  const handleStartSensors = async () => {
    try {
      setError('')
      setSensorData([]) // Clear previous data
      const result = await startSensors()
      setSensorsRunning(true)
      console.log('Sensors started:', result)
      // Start fetching data immediately
      const fetchData = async () => {
        try {
          const data = await getSensorData()
          setSensorData(data.data || [])
        } catch (err) {
          console.error('Error fetching initial sensor data:', err)
        }
      }
      // Fetch immediately and then every 5 seconds
      fetchData()
    } catch (err) {
      setError('Failed to start sensors: ' + err.message)
      setSensorsRunning(false)
      console.error('Error starting sensors:', err)
    }
  }

  const handleStopSensors = async () => {
    try {
      await stopSensors()
      setSensorsRunning(false)
      setError('')
    } catch (err) {
      setError('Failed to stop sensors: ' + err.message)
    }
  }

  const handleStartGraph = async () => {
    try {
      await startLiveGraph()
      setGraphRunning(true)
      setError('')
    } catch (err) {
      setError('Failed to start live graph: ' + err.message)
    }
  }

  const handleStopGraph = async () => {
    try {
      await stopLiveGraph()
      setGraphRunning(false)
      setError('')
    } catch (err) {
      setError('Failed to stop live graph: ' + err.message)
    }
  }

  // ML Prediction handlers
  const handleMlInputChange = (e) => {
    const { name, value } = e.target
    setMlPredictionData(prev => ({ ...prev, [name]: value }))
  }

  const handleMlPredict = async (e) => {
    e.preventDefault()
    setMlLoading(true)
    setMlPredictionResult(null)
    setError('')

    try {
      const data = {
        Temp: parseFloat(mlPredictionData.Temp),
        DO: parseFloat(mlPredictionData.DO),
        pH: parseFloat(mlPredictionData.pH),
        Conductivity: parseFloat(mlPredictionData.Conductivity),
        BOD: parseFloat(mlPredictionData.BOD),
        Nitrate: parseFloat(mlPredictionData.Nitrate),
        FecalColiform: parseFloat(mlPredictionData.FecalColiform),
        TotalColiform: parseFloat(mlPredictionData.TotalColiform)
      }

      const result = await predictWaterQuality(data)
      setMlPredictionResult(result)
    } catch (err) {
      setError('ML Prediction failed: ' + err.message)
      console.error('ML Prediction error:', err)
    } finally {
      setMlLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className={pageClass}>
        {!isAuthenticated ? (
          <div className="official-login-wrapper">
            <section className="official-card login-card">
              <h1>Officials Access</h1>
              <form onSubmit={handleLogin} className="official-login-form">
                <label>
                  Username
                  <input
                    type="text"
                    value={login.username}
                    onChange={e => setLogin(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={login.password}
                    onChange={e => setLogin(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </label>
                <button type="submit" className="official-primary-btn">
                  Enter Dashboard
                </button>
                {error && <p className="official-error">{error}</p>}
              </form>
            </section>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1.5rem', width: '100%' }}>
            {/* Admin Sidebar */}
            {showSidebar && (
              <aside className="admin-sidebar" style={{
                width: '280px',
                minWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <section className="official-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Admin Controls</h2>
                    <button 
                      onClick={() => setShowSidebar(false)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* Sensor Controls */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#cbd5e1' }}>Synthetic Sensors</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleStartSensors}
                        disabled={sensorsRunning}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: sensorsRunning ? 'rgba(148, 163, 184, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: sensorsRunning ? '#94a3b8' : '#4ade80',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: sensorsRunning ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        {sensorsRunning ? '🟢 Running' : '▶ Start'}
                      </button>
                      <button
                        onClick={handleStopSensors}
                        disabled={!sensorsRunning}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: !sensorsRunning ? 'rgba(148, 163, 184, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                          color: !sensorsRunning ? '#94a3b8' : '#f87171',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: !sensorsRunning ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        ⏹ Stop
                      </button>
                    </div>
                  </div>

                  {/* Graph Controls */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#cbd5e1' }}>Live Graph</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleStartGraph}
                        disabled={graphRunning}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: graphRunning ? 'rgba(148, 163, 184, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: graphRunning ? '#94a3b8' : '#4ade80',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: graphRunning ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        {graphRunning ? '🟢 Running' : '▶ Start'}
                      </button>
                      <button
                        onClick={handleStopGraph}
                        disabled={!graphRunning}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: !graphRunning ? 'rgba(148, 163, 184, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                          color: !graphRunning ? '#94a3b8' : '#f87171',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: !graphRunning ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        ⏹ Stop
                      </button>
                    </div>
                  </div>

                  {/* ML Prediction Form */}
                  <div>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#cbd5e1' }}>ML Prediction</h3>
                    <form onSubmit={handleMlPredict} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="number"
                        name="Temp"
                        placeholder="Temp (°C)"
                        value={mlPredictionData.Temp}
                        onChange={handleMlInputChange}
                        step="0.1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="DO"
                        placeholder="DO (mg/L)"
                        value={mlPredictionData.DO}
                        onChange={handleMlInputChange}
                        step="0.1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="pH"
                        placeholder="pH"
                        value={mlPredictionData.pH}
                        onChange={handleMlInputChange}
                        step="0.1"
                        min="0"
                        max="14"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="Conductivity"
                        placeholder="Conductivity"
                        value={mlPredictionData.Conductivity}
                        onChange={handleMlInputChange}
                        step="0.1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="BOD"
                        placeholder="BOD (mg/L)"
                        value={mlPredictionData.BOD}
                        onChange={handleMlInputChange}
                        step="0.1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="Nitrate"
                        placeholder="Nitrate (mg/L)"
                        value={mlPredictionData.Nitrate}
                        onChange={handleMlInputChange}
                        step="0.1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="FecalColiform"
                        placeholder="Fecal Coliform"
                        value={mlPredictionData.FecalColiform}
                        onChange={handleMlInputChange}
                        step="1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        name="TotalColiform"
                        placeholder="Total Coliform"
                        value={mlPredictionData.TotalColiform}
                        onChange={handleMlInputChange}
                        step="1"
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(15, 23, 42, 0.7)', color: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <button
                        type="submit"
                        disabled={mlLoading}
                        style={{
                          padding: '0.6rem',
                          background: 'rgba(96, 165, 250, 0.2)',
                          color: '#bfdbfe',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: mlLoading ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          marginTop: '0.25rem'
                        }}
                      >
                        {mlLoading ? 'Predicting...' : 'Predict Risk'}
                      </button>
                    </form>

                    {/* ML Prediction Result */}
                    {mlPredictionResult && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#cbd5e1' }}>Prediction Result</h4>
                        <div style={{ fontSize: '0.85rem' }}>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: '#94a3b8' }}>Risk Level: </span>
                            <span style={{ 
                              color: mlPredictionResult.riskLevel === 'High' ? '#f87171' : 
                                     mlPredictionResult.riskLevel === 'Medium' ? '#facc15' : '#4ade80',
                              fontWeight: '600'
                            }}>
                              {mlPredictionResult.riskLevel}
                            </span>
                          </div>
                          {mlPredictionResult.riskScore && (
                            <div style={{ marginBottom: '0.25rem' }}>
                              <span style={{ color: '#94a3b8' }}>Risk Score: </span>
                              <span style={{ color: '#e2e8f0' }}>{mlPredictionResult.riskScore}%</span>
                            </div>
                          )}
                          {mlPredictionResult.confidence && (
                            <div>
                              <span style={{ color: '#94a3b8' }}>Confidence: </span>
                              <span style={{ color: '#e2e8f0' }}>{mlPredictionResult.confidence.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </aside>
            )}

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && (
              <section className="official-card">
                <p className="official-error" style={{ margin: 0 }}>{error}</p>
                <button 
                  onClick={() => setError('')} 
                  style={{ marginTop: '0.5rem', padding: '0.25rem 0.75rem', background: 'rgba(148, 163, 184, 0.2)', color: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </section>
            )}
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                style={{
                  position: 'fixed',
                  left: '1rem',
                  top: '100px',
                  zIndex: 1000,
                  padding: '0.75rem',
                  background: 'rgba(96, 165, 250, 0.2)',
                  color: '#bfdbfe',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1.2rem'
                }}
              >
                ☰
              </button>
            )}
            
            {/* Live Graph Display - Above Map */}
            {graphRunning && (
              <section className="official-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>Live Water Quality Monitoring</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#4ade80',
                      animation: 'pulse 2s infinite'
                    }}></div>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Live</span>
                  </div>
                </div>
                {graphImageUrl ? (
                  <div style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '500px'
                  }}>
                    <img
                      src={graphImageUrl}
                      alt="Live Water Quality Graph"
                      style={{
                        width: '100%',
                        maxWidth: '1200px',
                        height: 'auto',
                        display: 'block'
                      }}
                      onError={(e) => {
                        console.error('Error loading graph image')
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    minHeight: '500px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                    <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Waiting for graph data...</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>The graph will appear here once sensor data is available</div>
                  </div>
                )}
              </section>
            )}
            
            <section className="official-card summary-card">
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">New reports today</span>
                  <span className="summary-value">{summary.newReports}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">High risk zones</span>
                  <span className="summary-value">{summary.highRisk}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Emergency requests</span>
                  <span className="summary-value">{summary.emergencyCount}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Most affected area</span>
                  <span className="summary-value">{summary.topArea}</span>
                </div>
              </div>
            </section>

            <section className="official-card map-section">
              <h2>Risk Map</h2>
              <div className="official-map" ref={mapRef}></div>
            </section>

            <section className="official-card table-section">
              <h2>Recent Reports</h2>
              {loading ? (
                <p>Loading reports…</p>
              ) : (
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Village</th>
                      <th>Cases</th>
                      <th>Water</th>
                      <th>Risk</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => (
                      <tr key={report.id}>
                        <td>{report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '-'}</td>
                        <td>{report.villageName || 'Unknown'}</td>
                        <td>{report.peopleCount || '0'}</td>
                        <td>{report.waterSource || '-'}</td>
                        <td>
                          <span className={`risk-badge risk-${report.risk.toLowerCase()}`}>{report.risk}</span>
                        </td>
                        <td>
                          <button className="view-btn" onClick={() => handleViewReport(report)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {selectedReport && (
              <section className="official-card detail-card">
                <div className="detail-header">
                  <h2>Report Detail</h2>
                  <button type="button" onClick={() => { setSelectedReport(null); setPreviewUrl('') }}>
                    Close
                  </button>
                </div>
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">ASHA Name</span>
                    <p>{selectedReport.ashaName || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Village</span>
                    <p>{selectedReport.villageName || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">People sick</span>
                    <p>{selectedReport.peopleCount || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Days since onset</span>
                    <p>{selectedReport.daysSinceOnset || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Symptoms</span>
                    <p>{Array.isArray(selectedReport.mainSymptoms) ? selectedReport.mainSymptoms.join(', ') : '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Water source</span>
                    <p>{selectedReport.waterSource || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Water muddy?</span>
                    <p>{selectedReport.waterDirty === 'yes' ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Recent flooding?</span>
                    <p>{selectedReport.flooding === 'yes' ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Coordinates</span>
                    <p>
                      {selectedReport.latitude || '—'}, {selectedReport.longitude || '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="detail-label">Notes</span>
                  <p>{selectedReport.notes || 'No notes provided.'}</p>
                </div>
                {previewUrl && (
                  <div className="report-preview">
                    <iframe title="Report PDF preview" src={previewUrl}></iframe>
                  </div>
                )}
              </section>
            )}

            <section className="official-card table-section">
              <h2>Emergency Requests</h2>
              {loading ? (
                <p>Loading emergency requests…</p>
              ) : emergencyReports.length === 0 ? (
                <p>No emergency submissions yet.</p>
              ) : (
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Water Body</th>
                      <th>Location</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencyReports.map(report => (
                      <tr key={report.id}>
                        <td>{report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '-'}</td>
                        <td>{report.waterBodyName || '-'}</td>
                        <td>{report.location || '-'}</td>
                        <td>
                          <div className="table-actions">
                            <button className="action-btn" onClick={() => handleViewEmergency(report)}>
                            View
                          </button>
                            <button className="action-btn download-btn" onClick={() => handleDownloadEmergency(report)}>
                              Download
                            </button>
                            <button
                              className="action-btn delete-btn"
                              onClick={() => handleDeleteEmergency(report)}
                              disabled={deletingEmergencyId === report.id}
                            >
                              {deletingEmergencyId === report.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {selectedEmergency && (
              <section className="official-card detail-card">
                <div className="detail-header">
                  <h2>Emergency Detail</h2>
                  <button type="button" onClick={() => { setSelectedEmergency(null); setEmergencyPreviewUrl('') }}>
                    Close
                  </button>
                </div>
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">Aadhaar</span>
                    <p>{selectedEmergency.aadhar || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Water Body</span>
                    <p>{selectedEmergency.waterBodyName || '-'}</p>
                  </div>
                  <div>
                    <span className="detail-label">Location</span>
                    <p>{selectedEmergency.location || '-'}</p>
                  </div>
                </div>
                <div>
                  <span className="detail-label">Concern</span>
                  <p>{selectedEmergency.concern || 'No details provided.'}</p>
                </div>
                {emergencyPreviewUrl && (
                  <div className="report-preview">
                    <iframe title="Emergency PDF preview" src={emergencyPreviewUrl}></iframe>
                  </div>
                )}
              </section>
            )}
            {reports.length > 0 && (
              <section className="official-card archive-section">
                <div className="archive-header">
                  <button type="button" className="archive-nav" onClick={handlePrevReport}>‹</button>
                  <div>
                    <h2>Reports Archive</h2>
                    <span className="archive-count">{reportIndex + 1} / {reports.length}</span>
                  </div>
                  <button type="button" className="archive-nav" onClick={handleNextReport}>›</button>
                </div>
                {currentReport && (
                  <div className="report-card">
                    <div>
                      <h3>{currentReport.villageName || 'Untitled report'}</h3>
                      <p className="report-date">{formatDateOnly(currentReport.submittedAt)}</p>
                    </div>
                    <div className="report-actions">
                      <button
                        type="button"
                        className="report-action-btn"
                        onClick={() => handleViewReport(currentReport)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="report-action-btn download-btn"
                        onClick={() => handleDownloadReport(currentReport)}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        className="report-action-btn delete-btn"
                        onClick={() => handleDeleteReport(currentReport)}
                        disabled={deletingReportId === currentReport.id}
                      >
                        {deletingReportId === currentReport.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Live Sensor Data Section */}
            {sensorsRunning && (
              <section className="official-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>Live Sensor Data</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: '#4ade80',
                      animation: 'pulse 2s infinite'
                    }}></div>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Generating...</span>
                  </div>
                </div>
                
                {sensorData.length === 0 ? (
                  <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    background: 'rgba(15, 23, 42, 0.8)', 
                    borderRadius: '8px',
                    color: '#94a3b8'
                  }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                    <div style={{ fontSize: '0.9rem' }}>Collecting initial sensor readings...</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                      The sensor is building up its history buffer to make accurate predictions.
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '1rem' }}>
                    {/* Latest Reading Card */}
                    <div style={{ 
                      padding: '1rem', 
                      background: 'rgba(15, 23, 42, 0.8)', 
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      border: '1px solid rgba(96, 165, 250, 0.3)'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: '600' }}>
                        Latest Reading
                      </div>
                      {sensorData.slice(-1).map((reading, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Temperature</div>
                            <div style={{ fontSize: '1.1rem', color: '#e2e8f0', fontWeight: '600' }}>
                              {reading.Temp?.toFixed(1) || 'N/A'}°C
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Dissolved Oxygen</div>
                            <div style={{ fontSize: '1.1rem', color: '#e2e8f0', fontWeight: '600' }}>
                              {reading.DO?.toFixed(1) || 'N/A'} mg/L
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>pH Level</div>
                            <div style={{ fontSize: '1.1rem', color: '#e2e8f0', fontWeight: '600' }}>
                              {reading.pH?.toFixed(1) || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Risk Level</div>
                            <div style={{ 
                              fontSize: '1.1rem', 
                              fontWeight: '600',
                              color: reading.Risk === 'High' ? '#f87171' : 
                                     reading.Risk === 'Medium' ? '#facc15' : '#4ade80'
                            }}>
                              {reading.Risk || 'N/A'}
                            </div>
                          </div>
                          {reading.Confidence && (
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Confidence</div>
                              <div style={{ fontSize: '1.1rem', color: '#e2e8f0', fontWeight: '600' }}>
                                {parseFloat(reading.Confidence).toFixed(1)}%
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Additional Parameters */}
                    {sensorData.length > 0 && sensorData[sensorData.length - 1] && (
                      <div style={{ 
                        padding: '1rem', 
                        background: 'rgba(15, 23, 42, 0.6)', 
                        borderRadius: '8px',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: '600' }}>
                          Additional Parameters
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Conductivity: </span>
                            <span style={{ color: '#e2e8f0' }}>{sensorData[sensorData.length - 1].Conductivity?.toFixed(0) || 'N/A'}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>BOD: </span>
                            <span style={{ color: '#e2e8f0' }}>{sensorData[sensorData.length - 1].BOD?.toFixed(2) || 'N/A'} mg/L</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Nitrate: </span>
                            <span style={{ color: '#e2e8f0' }}>{sensorData[sensorData.length - 1].Nitrate?.toFixed(2) || 'N/A'} mg/L</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Fecal Coliform: </span>
                            <span style={{ color: '#e2e8f0' }}>{sensorData[sensorData.length - 1].FecalColiform?.toFixed(0) || 'N/A'}</span>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Total Coliform: </span>
                            <span style={{ color: '#e2e8f0' }}>{sensorData[sensorData.length - 1].TotalColiform?.toFixed(0) || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Statistics */}
                    <div style={{ 
                      padding: '0.75rem', 
                      background: 'rgba(15, 23, 42, 0.4)', 
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <span>📊 Total readings: <strong style={{ color: '#e2e8f0' }}>{sensorData.length}</strong></span>
                      <span>🕐 Last updated: <strong style={{ color: '#e2e8f0' }}>
                        {sensorData.length > 0 && sensorData[sensorData.length - 1].timestamp 
                          ? new Date(sensorData[sensorData.length - 1].timestamp).toLocaleTimeString() 
                          : 'N/A'}
                      </strong></span>
                      <span>🔄 Update interval: <strong style={{ color: '#e2e8f0' }}>5 seconds</strong></span>
                    </div>
                  </div>
                )}
              </section>
            )}
            </div>
          </div>
        )}
      </main>
    </>
  )
}

export default OfficialDashboard

