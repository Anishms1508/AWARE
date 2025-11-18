import { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './Navbar'
import './OfficialDashboard.css'
import { fetchAshaReports, fetchEmergencyReports, deleteAshaReport, deleteEmergencyReport } from '../services/reportService'
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
          <>
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
          </>
        )}
      </main>
    </>
  )
}

export default OfficialDashboard

