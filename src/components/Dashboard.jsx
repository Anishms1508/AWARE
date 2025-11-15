import { useState } from 'react'
import ClerkUserInfo from './ClerkUserInfo'
import './Dashboard.css'

function Dashboard() {
  // Check for Clerk key with both naming conventions
  const hasClerkKey = !!(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const [predictionData, setPredictionData] = useState({
    location: '',
    waterSource: 'tap',
    temperature: '',
    ph: '',
    turbidity: '',
    chlorine: ''
  })
  const [predictionResult, setPredictionResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

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
    
    // Simulate API call - replace with actual API endpoint
    setTimeout(() => {
      const riskScore = Math.random() * 100
      const riskLevel = riskScore < 30 ? 'Low' : riskScore < 70 ? 'Medium' : 'High'
      const diseases = riskScore > 50 ? 
        ['Cholera', 'Typhoid', 'Dysentery'] : 
        riskScore > 30 ? ['Gastroenteritis'] : []
      
      setPredictionResult({
        riskScore: riskScore.toFixed(1),
        riskLevel,
        diseases,
        recommendations: getRecommendations(riskLevel)
      })
      setIsLoading(false)
    }, 1500)
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
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">AWARE Dashboard</h1>
          <div className="header-actions">
            {hasClerkKey ? (
              <ClerkUserInfo />
            ) : (
              <span className="user-greeting">Welcome to AWARE Dashboard</span>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
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
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="turbidity">Turbidity (NTU)</label>
                  <input
                    type="number"
                    id="turbidity"
                    name="turbidity"
                    value={predictionData.turbidity}
                    onChange={handleInputChange}
                    placeholder="1.0"
                    step="0.1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="chlorine">Chlorine (mg/L)</label>
                  <input
                    type="number"
                    id="chlorine"
                    name="chlorine"
                    value={predictionData.chlorine}
                    onChange={handleInputChange}
                    placeholder="0.5"
                    step="0.1"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="predict-button" disabled={isLoading}>
                {isLoading ? 'Analyzing...' : 'Predict Risk'}
              </button>
            </form>
          </div>

          {/* Prediction Results */}
          {predictionResult && (
            <div className="dashboard-card results-card">
              <h2 className="card-title">Prediction Results</h2>
              <div className={`risk-indicator risk-${predictionResult.riskLevel.toLowerCase()}`}>
                <div className="risk-score">
                  <span className="score-value">{predictionResult.riskScore}%</span>
                  <span className="risk-level">{predictionResult.riskLevel} Risk</span>
                </div>
              </div>

              {predictionResult.diseases.length > 0 && (
                <div className="diseases-section">
                  <h3>Potential Diseases</h3>
                  <div className="diseases-list">
                    {predictionResult.diseases.map((disease, idx) => (
                      <span key={idx} className="disease-tag">{disease}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="recommendations-section">
                <h3>Recommendations</h3>
                <ul className="recommendations-list">
                  {predictionResult.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
        </div>
      </main>
    </div>
    </>
  )
}

export default Dashboard

