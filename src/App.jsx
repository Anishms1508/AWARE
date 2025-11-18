import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { useMemo } from 'react'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import EmergencyRequest from './components/EmergencyRequest'
import AshaReport from './components/AshaReport'
import OfficialDashboard from './components/OfficialDashboard'
import './App.css'
import { hasOfficialAccess } from './utils/accessControl'

const OfficialOnly = ({ children }) => {
  const { user } = useUser()
  const canAccessOfficial = useMemo(() => hasOfficialAccess(user), [user])

  if (!canAccessOfficial) {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  // Check for Clerk key with both naming conventions
  const hasClerkKey = !!(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  // If Clerk is not configured, show landing page and allow dashboard access without auth
  if (!hasClerkKey) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/asha-report" element={<AshaReport />} />
          <Route path="/official-dashboard" element={<OfficialDashboard />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // With Clerk configured, use authentication
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={<LandingPage />}
        />
        <Route 
          path="/dashboard" 
          element={
            <>
              <SignedIn>
                <Dashboard />
              </SignedIn>
              <SignedOut>
                <Navigate to="/" replace />
              </SignedOut>
            </>
          } 
        />
        <Route 
          path="/asha-report" 
          element={
            <>
              <SignedIn>
                <OfficialOnly>
                  <AshaReport />
                </OfficialOnly>
              </SignedIn>
              <SignedOut>
                <Navigate to="/" replace />
              </SignedOut>
            </>
          }
        />
        <Route 
          path="/official-dashboard" 
          element={
            <>
              <SignedIn>
                <OfficialOnly>
                  <OfficialDashboard />
                </OfficialOnly>
              </SignedIn>
              <SignedOut>
                <Navigate to="/" replace />
              </SignedOut>
            </>
          }
        />
        <Route 
          path="/emergency-request" 
          element={<EmergencyRequest />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
