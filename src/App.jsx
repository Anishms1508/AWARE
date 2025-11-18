import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import EmergencyRequest from './components/EmergencyRequest'
import AshaReport from './components/AshaReport'
import './App.css'

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
                <AshaReport />
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
