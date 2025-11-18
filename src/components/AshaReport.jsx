import { useEffect, useMemo, useState } from 'react'
import Navbar from './Navbar'
import './AshaReport.css'
import { saveAshaWorkerReport } from '../services/reportService'

function AshaReport() {
  const credentials = useMemo(() => ({ username: 'user', password: '12345' }), [])

  const initialFormState = {
    ashaName: '',
    villageName: '',
    peopleCount: '1',
    daysSinceOnset: '',
    ageGroup: '18-60',
    waterSource: 'Handpump',
    waterDirty: 'no',
    flooding: 'no',
    notes: '',
    mainSymptoms: [],
    latitude: '',
    longitude: ''
  }

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginFields, setLoginFields] = useState({ username: '', password: '' })
  const [formData, setFormData] = useState(initialFormState)
  const [formStatus, setFormStatus] = useState('')
  const [isSavingReport, setIsSavingReport] = useState(false)
  const [view, setView] = useState('form')
  const [lastReportSummary, setLastReportSummary] = useState(null)
  const [reportHistory, setReportHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('ashaReports')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('Unable to parse stored ASHA reports', error)
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('ashaReports', JSON.stringify(reportHistory))
  }, [reportHistory])

  useEffect(() => {
    if (!isAuthenticated || !('geolocation' in navigator)) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(5),
          longitude: pos.coords.longitude.toFixed(5)
        }))
        setFormStatus('Auto location captured successfully.')
      },
      () => setFormStatus('Auto location failed. Please enter coordinates manually.'),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000
      }
    )
  }, [isAuthenticated, view])

  const handleLoginSubmit = (e) => {
    e.preventDefault()
    if (
      loginFields.username.trim() === credentials.username &&
      loginFields.password === credentials.password
    ) {
      setIsAuthenticated(true)
      setFormStatus('Access granted. Complete the report below.')
    } else {
      setFormStatus('Invalid credentials. Please try again.')
    }
  }

  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const toggleMainSymptom = (symptom) => {
    setFormData(prev => {
      const exists = prev.mainSymptoms.includes(symptom)
      return {
        ...prev,
        mainSymptoms: exists
          ? prev.mainSymptoms.filter(item => item !== symptom)
          : [...prev.mainSymptoms, symptom]
      }
    })
  }

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    setIsSavingReport(true)
    setFormStatus('')
    const isOnline = navigator.onLine
    const timestamp = new Date().toISOString()

    const normalizedReport = {
      id: `${Date.now()}`,
      ...formData,
      createdAt: timestamp,
      submittedBy: credentials.username,
      mainSymptoms: formData.mainSymptoms.length ? formData.mainSymptoms : ['Not specified']
    }

    if (!isOnline) {
      setFormStatus('Report saved offline. It will sync once online.')
      setReportHistory(prev => [{ ...normalizedReport, status: 'Pending sync' }, ...prev].slice(0, 30))
      setIsSavingReport(false)
      return
    }

    try {
      const docRef = await saveAshaWorkerReport(normalizedReport)
      const record = { ...normalizedReport, id: docRef.id, status: 'Synced' }
      setReportHistory(prev => [record, ...prev].slice(0, 30))
      setLastReportSummary(record)
      setFormStatus('Report submitted successfully.')
      setView('success')
      setIsSavingReport(false)
    } catch (error) {
      console.error('Unable to save ASHA report to Firebase', error)
      setFormStatus('Could not reach Firebase. Report stored locally.')
      setReportHistory(prev => [{ ...normalizedReport, status: 'Failed' }, ...prev].slice(0, 30))
      setIsSavingReport(false)
    }
  }

  const handleDraftAnotherReport = () => {
    setFormData(initialFormState)
    setFormStatus('')
    setView('form')
    setLastReportSummary(null)
  }

  return (
    <>
      <Navbar />
      <main className="asha-page">
        <div className="asha-wrapper">
          <header className="asha-page-header">
            <h1>ASHA Worker Report</h1>
            <p>Log health symptoms, water conditions, and flooding indicators for your village.</p>
            <button type="button" className="asha-back-button" onClick={() => window.close()}>
              Close Window
            </button>
          </header>

          <section className="asha-card">
            {!isAuthenticated ? (
              <form className="asha-login" onSubmit={handleLoginSubmit}>
                <h2>Verify ASHA Credentials</h2>
                <label>
                  Username
                  <input
                    type="text"
                    name="username"
                    value={loginFields.username}
                    onChange={e => setLoginFields(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    value={loginFields.password}
                    onChange={e => setLoginFields(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </label>
                <button className="asha-primary-btn" type="submit">
                  Continue
                </button>
                {formStatus && <p className="asha-status">{formStatus}</p>}
              </form>
            ) : view === 'form' ? (
              <>
                {!navigator.onLine && (
                  <div className="offline-banner">
                    You are offline. Reports will sync automatically when a connection returns.
                  </div>
                )}
                <form className="asha-form" onSubmit={handleReportSubmit}>
                  <label>
                    ASHA Name / ID
                    <input
                      type="text"
                      name="ashaName"
                      value={formData.ashaName}
                      onChange={handleFieldChange}
                      placeholder="e.g., Sita Devi / ASHA-102"
                      required
                    />
                  </label>

                  <label>
                    Village / Locality Name
                    <input
                      type="text"
                      name="villageName"
                      value={formData.villageName}
                      onChange={handleFieldChange}
                      placeholder="Village or locality"
                      required
                    />
                  </label>

                  <div className="form-row">
                    <label>
                      Latitude (auto)
                      <input
                        type="text"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleFieldChange}
                        placeholder="30.76420"
                      />
                    </label>
                    <label>
                      Longitude (auto)
                      <input
                        type="text"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleFieldChange}
                        placeholder="76.78164"
                      />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Number of People Sick
                      <input
                        type="number"
                        name="peopleCount"
                        min="1"
                        value={formData.peopleCount}
                        onChange={handleFieldChange}
                        required
                      />
                    </label>
                    <label>
                      Days Since Symptoms Started
                      <input
                        type="number"
                        name="daysSinceOnset"
                        min="0"
                        value={formData.daysSinceOnset}
                        onChange={handleFieldChange}
                        placeholder="e.g., 2"
                        required
                      />
                    </label>
                  </div>

                  <div className="symptom-section">
                    <span>Main Symptoms (select all that apply)</span>
                    <div className="symptom-options checkbox-grid">
                      {['Diarrhoea', 'Vomiting', 'Fever', 'Abdominal pain', 'Other'].map(symptom => (
                        <label key={symptom} className="checkbox-option">
                          <input
                            type="checkbox"
                            checked={formData.mainSymptoms.includes(symptom)}
                            onChange={() => toggleMainSymptom(symptom)}
                          />
                          {symptom}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label>
                    Age Group Most Affected
                    <select name="ageGroup" value={formData.ageGroup} onChange={handleFieldChange}>
                      <option value="0-5">0–5</option>
                      <option value="6-17">6–17</option>
                      <option value="18-60">18–60</option>
                      <option value="60+">60+</option>
                    </select>
                  </label>

                  <label>
                    Drinking Water Source
                    <select
                      name="waterSource"
                      value={formData.waterSource}
                      onChange={handleFieldChange}
                    >
                      <option value="Handpump">Handpump</option>
                      <option value="Well">Well</option>
                      <option value="River/Stream">River/Stream</option>
                      <option value="Tanker">Tanker</option>
                      <option value="Piped Supply">Piped Supply</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <div className="form-row">
                    <label>
                      Is the water dirty/muddy?
                      <select
                        name="waterDirty"
                        value={formData.waterDirty}
                        onChange={handleFieldChange}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                    <label>
                      Recent heavy rain / flooding (7 days)?
                      <select
                        name="flooding"
                        value={formData.flooding}
                        onChange={handleFieldChange}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    Notes / observations
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleFieldChange}
                      placeholder="Add any quick observations..."
                    ></textarea>
                  </label>

                  <button className="asha-primary-btn" type="submit" disabled={isSavingReport}>
                    {isSavingReport ? 'Saving...' : 'Submit report'}
                  </button>
                  {formStatus && <p className="asha-status">{formStatus}</p>}
                </form>
              </>
            ) : (
              <div className="asha-success">
                <h2>Report submitted successfully</h2>
                {lastReportSummary && (
                  <div className="asha-success-summary">
                    <p><strong>{new Date(lastReportSummary.createdAt).toLocaleString()}</strong></p>
                    <p>{lastReportSummary.peopleCount} people affected • Symptoms: {lastReportSummary.mainSymptoms.join(', ')}</p>
                    {(lastReportSummary.latitude || lastReportSummary.longitude) && (
                      <p>Coordinates: {lastReportSummary.latitude || '—'}, {lastReportSummary.longitude || '—'}</p>
                    )}
                  </div>
                )}
                <div className="asha-success-actions">
                  <button className="asha-primary-btn" onClick={handleDraftAnotherReport}>
                    Draft another report
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="asha-history-card">
            <h3>Past reports</h3>
            {reportHistory.length === 0 ? (
              <p>No reports saved yet.</p>
            ) : (
              <ul>
                {reportHistory.map(report => (
                  <li key={report.id}>
                    <div>
                      <strong>{new Date(report.createdAt).toLocaleString()}</strong>
                      <span className={`status-badge status-${report.status === 'Synced' ? 'synced' : report.status === 'Pending sync' ? 'pending' : 'failed'}`}>
                        {report.status}
                      </span>
                    </div>
                    <p>
                      {report.peopleCount} people • Symptoms: {Array.isArray(report.mainSymptoms) ? report.mainSymptoms.join(', ') : 'Not specified'}
                    </p>
                    {(report.latitude || report.longitude) && (
                      <p className="asha-coords">Coordinates: {report.latitude || '—'}, {report.longitude || '—'}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  )
}

export default AshaReport


