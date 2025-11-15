import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import './Setup.css'

function Setup() {
  const [copiedStep, setCopiedStep] = useState(null)
  const [completedSteps, setCompletedSteps] = useState({
    dependencies: false,
    env: false,
    clerk: false,
    backend: false,
    run: false
  })

  const copyToClipboard = (text, stepId) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(stepId)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  const toggleStep = (stepId) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  const setupSteps = [
    {
      id: 'dependencies',
      title: 'Install Dependencies',
      icon: '📦',
      description: 'Install all required Node.js packages for the frontend',
      commands: [
        {
          label: 'Windows',
          command: 'install.bat',
          id: 'cmd1'
        },
        {
          label: 'Linux/Mac',
          command: 'chmod +x install.sh && ./install.sh',
          id: 'cmd2'
        },
        {
          label: 'Manual',
          command: 'npm install',
          id: 'cmd3'
        }
      ],
      details: 'This will install React, Vite, Clerk, and all other frontend dependencies.'
    },
    {
      id: 'env',
      title: 'Set Up Environment Variables',
      icon: '🔑',
      description: 'Create .env.local file with your Clerk keys',
      commands: [
        {
          label: 'Create .env.local file',
          command: '# Create .env.local in the root directory',
          id: 'env1'
        },
        {
          label: 'Add Clerk Key',
          command: 'VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here',
          id: 'env2'
        }
      ],
      details: 'Vite requires the VITE_ prefix for environment variables to be exposed to the client.',
      link: 'https://clerk.com'
    },
    {
      id: 'clerk',
      title: 'Configure Clerk Authentication',
      icon: '🔐',
      description: 'Set up Clerk account and get your publishable key',
      steps: [
        'Go to clerk.com and sign up (free tier available)',
        'Create a new application',
        'Enable Google OAuth provider',
        'Copy your Publishable Key from the dashboard',
        'Add it to your .env.local file',
        'Configure redirect URLs: http://localhost:5173'
      ],
      details: 'Clerk provides secure authentication with Google OAuth. The free tier is perfect for development.',
      link: 'https://clerk.com'
    },
    {
      id: 'backend',
      title: 'Set Up FastAPI Backend',
      icon: '🐍',
      description: 'Install Python dependencies and start the ML model server',
      commands: [
        {
          label: 'Navigate to backend',
          command: 'cd backend',
          id: 'backend1'
        },
        {
          label: 'Create virtual environment',
          command: 'python -m venv venv',
          id: 'backend2'
        },
        {
          label: 'Activate venv (Windows)',
          command: 'venv\\Scripts\\activate',
          id: 'backend3'
        },
        {
          label: 'Activate venv (Linux/Mac)',
          command: 'source venv/bin/activate',
          id: 'backend4'
        },
        {
          label: 'Install dependencies',
          command: 'pip install -r requirements.txt',
          id: 'backend5'
        },
        {
          label: 'Start server',
          command: 'python main.py',
          id: 'backend6'
        }
      ],
      details: 'The backend serves the ML model for water quality predictions. It runs on http://localhost:8000',
      note: 'Make sure you have trained the model first (see extract/AWARE_random_forest_updated.ipynb)'
    },
    {
      id: 'run',
      title: 'Run the Application',
      icon: '🚀',
      description: 'Start the development server',
      commands: [
        {
          label: 'Start dev server',
          command: 'npm run dev',
          id: 'run1'
        }
      ],
      details: 'The application will open at http://localhost:5173. Make sure the backend is running on port 8000 for predictions to work.',
      success: '🎉 Your app should now be running!'
    }
  ]

  return (
    <>
      <Navbar />
      <div className="setup-page">
        <div className="setup-container">
          <div className="setup-header">
            <h1 className="setup-title">
              <span className="setup-icon">⚙️</span>
              Setup Guide
            </h1>
            <p className="setup-subtitle">
              Follow these steps to get AWARE up and running
            </p>
          </div>

          <div className="setup-steps">
            {setupSteps.map((step, index) => (
              <div 
                key={step.id} 
                className={`setup-step-card ${completedSteps[step.id] ? 'completed' : ''}`}
              >
                <div className="step-header">
                  <div className="step-number">{index + 1}</div>
                  <div className="step-title-section">
                    <h2 className="step-title">
                      <span className="step-icon">{step.icon}</span>
                      {step.title}
                    </h2>
                    <p className="step-description">{step.description}</p>
                  </div>
                  <button
                    className={`step-checkbox ${completedSteps[step.id] ? 'checked' : ''}`}
                    onClick={() => toggleStep(step.id)}
                    aria-label={`Mark step ${index + 1} as ${completedSteps[step.id] ? 'incomplete' : 'complete'}`}
                  >
                    {completedSteps[step.id] ? '✓' : ''}
                  </button>
                </div>

                {step.details && (
                  <p className="step-details">{step.details}</p>
                )}

                {step.commands && (
                  <div className="step-commands">
                    {step.commands.map((cmd) => (
                      <div key={cmd.id} className="command-block">
                        <div className="command-label">{cmd.label}</div>
                        <div className="command-wrapper">
                          <code className="command-text">{cmd.command}</code>
                          <button
                            className="copy-button"
                            onClick={() => copyToClipboard(cmd.command, cmd.id)}
                            title="Copy to clipboard"
                          >
                            {copiedStep === cmd.id ? '✓ Copied!' : '📋'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {step.steps && (
                  <ol className="step-list">
                    {step.steps.map((item, idx) => (
                      <li key={idx} className="step-list-item">{item}</li>
                    ))}
                  </ol>
                )}

                {step.note && (
                  <div className="step-note">
                    <strong>Note:</strong> {step.note}
                  </div>
                )}

                {step.link && (
                  <a 
                    href={step.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="step-link"
                  >
                    Learn more →
                  </a>
                )}

                {step.success && completedSteps[step.id] && (
                  <div className="step-success">{step.success}</div>
                )}
              </div>
            ))}
          </div>

          <div className="setup-footer">
            <div className="verification-section">
              <h3 className="verification-title">Verification Checklist</h3>
              <div className="checklist">
                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={completedSteps.dependencies}
                    onChange={() => toggleStep('dependencies')}
                  />
                  <span>Dependencies installed (node_modules folder exists)</span>
                </label>
                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={completedSteps.env}
                    onChange={() => toggleStep('env')}
                  />
                  <span>.env.local file created with Clerk key</span>
                </label>
                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={completedSteps.clerk}
                    onChange={() => toggleStep('clerk')}
                  />
                  <span>Clerk application configured with Google OAuth</span>
                </label>
                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={completedSteps.backend}
                    onChange={() => toggleStep('backend')}
                  />
                  <span>Backend server running on http://localhost:8000</span>
                </label>
                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={completedSteps.run}
                    onChange={() => toggleStep('run')}
                  />
                  <span>Development server starts without errors</span>
                </label>
              </div>
            </div>

            <div className="troubleshooting-section">
              <h3 className="troubleshooting-title">Common Issues</h3>
              <div className="troubleshooting-list">
                <div className="troubleshooting-item">
                  <strong>"Missing Publishable Key" error:</strong>
                  <ul>
                    <li>Make sure .env.local file exists in the root directory</li>
                    <li>Verify the key starts with pk_test_ or pk_live_</li>
                    <li>Restart the dev server after creating/updating .env</li>
                  </ul>
                </div>
                <div className="troubleshooting-item">
                  <strong>Port 5173 already in use:</strong>
                  <ul>
                    <li>Change the port in vite.config.js</li>
                    <li>Or use: npm run dev -- --port 3000</li>
                  </ul>
                </div>
                <div className="troubleshooting-item">
                  <strong>Backend connection errors:</strong>
                  <ul>
                    <li>Ensure the backend is running on port 8000</li>
                    <li>Check that the ML model file exists (rf_water_model.joblib)</li>
                    <li>Verify all Python dependencies are installed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="setup-actions">
              <Link to="/" className="setup-button secondary">
                ← Back to Home
              </Link>
              <Link to="/dashboard" className="setup-button primary">
                Go to Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Setup

