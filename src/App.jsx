import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
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
      </Routes>
    </BrowserRouter>
  )
}

export default App
