import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

// Import your publishable key from environment variables
// Note: Vite only exposes variables with VITE_ prefix to the client
// Support both VITE_ and NEXT_PUBLIC_ (though NEXT_PUBLIC_ won't work in Vite)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Show warning if key is missing but don't crash the app
if (!PUBLISHABLE_KEY) {
  console.warn('⚠️ Clerk Publishable Key is missing.')
  console.warn('Please add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file')
  console.warn('Note: Vite requires the VITE_ prefix for environment variables')
  console.warn('The app will display, but authentication will not function.')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      // Show app without Clerk - components will handle missing auth gracefully
      <App />
    )}
  </StrictMode>,
)
