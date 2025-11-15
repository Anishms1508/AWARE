import { SignInButton } from '@clerk/clerk-react'
import Navbar from './Navbar'
import './LandingPage.css'

function LandingPage() {
  // Check for Clerk key with both naming conventions
  const hasClerkKey = !!(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <>
      <Navbar />
      <div className="landing-page">
      <div className="landing-container">
        <div className="hero-section">
          <h1 className="hero-title">
            <span className="title-accent">AWARE</span>
            <br />
            Waterborne Disease Predictor
          </h1>
          <p className="hero-subtitle">
            Advanced analytics and prediction system for waterborne disease monitoring
          </p>
          <p className="hero-description">
            Monitor water quality, predict disease outbreaks, and protect your community 
            with AI-powered insights and real-time data analysis.
          </p>
          
          <div className="auth-section">
            {hasClerkKey ? (
              <SignInButton mode="modal">
                <button className="sign-in-button">
                  <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </SignInButton>
            ) : (
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                padding: '1rem 2rem', 
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <p style={{ color: 'white', margin: 0, fontSize: '0.95rem' }}>
                  ⚠️ Authentication not configured. Please set up Clerk to enable sign-in.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="features-section">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Real-time Monitoring</h3>
            <p>Track water quality metrics in real-time across multiple locations</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔮</div>
            <h3>AI Predictions</h3>
            <p>Advanced machine learning models predict disease outbreaks before they happen</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Analytics Dashboard</h3>
            <p>Comprehensive data visualization and trend analysis</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔔</div>
            <h3>Alert System</h3>
            <p>Get instant notifications when risk levels exceed safe thresholds</p>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default LandingPage

