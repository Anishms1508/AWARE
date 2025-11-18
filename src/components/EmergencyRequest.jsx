import { useState } from 'react'
import Navbar from './Navbar'
import './EmergencyRequest.css'
import { saveEmergencyReport } from '../services/reportService'

function EmergencyRequest() {
  const [formData, setFormData] = useState({
    aadhar: '',
    waterBodyName: '',
    location: '',
    concern: ''
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateAadhar = (aadhar) => {
    // Aadhaar should be 12 digits
    const aadharRegex = /^\d{12}$/
    return aadharRegex.test(aadhar.replace(/\s/g, ''))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    const newErrors = {}
    
    if (!formData.aadhar.trim()) {
      newErrors.aadhar = 'Aadhaar number is required'
    } else if (!validateAadhar(formData.aadhar)) {
      newErrors.aadhar = 'Aadhaar number must be 12 digits'
    }
    
    if (!formData.waterBodyName.trim()) {
      newErrors.waterBodyName = 'Water body name is required'
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    }
    
    if (!formData.concern.trim()) {
      newErrors.concern = 'Please describe your concern'
    } else if (formData.concern.trim().length < 20) {
      newErrors.concern = 'Please provide more details (at least 20 characters)'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      await saveEmergencyReport({
        ...formData,
        submittedBy: formData.aadhar,
        reporterType: 'citizen'
      })
      setSubmitSuccess(true)
      
      // Reset form after success
      setTimeout(() => {
        setFormData({
          aadhar: '',
          waterBodyName: '',
          location: '',
          concern: ''
        })
        setSubmitSuccess(false)
      }, 3000)
    } catch (error) {
      console.error('Error submitting form:', error)
      setErrors({
        submit: 'Failed to reach the report server. Please check your connection and try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="emergency-request-page">
        <div className="emergency-request-container">
          <div className="form-header">
            <h1 className="form-title">
              <span className="title-icon">🚨</span>
              Emergency Waterbody Check Request
            </h1>
            <p className="form-subtitle">
              Report urgent water quality concerns. Our team will prioritize your request and respond promptly.
            </p>
          </div>

          {submitSuccess && (
            <div className="success-message">
              <span className="success-icon">✓</span>
              <p>Your request has been submitted successfully! Our team will review it shortly.</p>
            </div>
          )}

          <form className="emergency-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <label htmlFor="aadhar" className="form-label">
                Aadhaar Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="aadhar"
                name="aadhar"
                value={formData.aadhar}
                onChange={handleChange}
                placeholder="Enter your 12-digit Aadhaar number"
                className={`form-input ${errors.aadhar ? 'input-error' : ''}`}
                maxLength="12"
              />
              {errors.aadhar && <span className="error-message">{errors.aadhar}</span>}
              <p className="form-hint">Your Aadhaar number is required for verification purposes</p>
            </div>

            <div className="form-section">
              <label htmlFor="waterBodyName" className="form-label">
                Water Body Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="waterBodyName"
                name="waterBodyName"
                value={formData.waterBodyName}
                onChange={handleChange}
                placeholder="e.g., Ganga River, Lake Victoria, Community Well"
                className={`form-input ${errors.waterBodyName ? 'input-error' : ''}`}
              />
              {errors.waterBodyName && <span className="error-message">{errors.waterBodyName}</span>}
            </div>

            <div className="form-section">
              <label htmlFor="location" className="form-label">
                Location <span className="required">*</span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter the exact location (village, city, district, state)"
                className={`form-input ${errors.location ? 'input-error' : ''}`}
              />
              {errors.location && <span className="error-message">{errors.location}</span>}
              <p className="form-hint">Please provide as much detail as possible (village, city, district, state)</p>
            </div>

            <div className="form-section">
              <label htmlFor="concern" className="form-label">
                Your Concern <span className="required">*</span>
              </label>
              <textarea
                id="concern"
                name="concern"
                value={formData.concern}
                onChange={handleChange}
                placeholder="Describe the issue you've observed (e.g., unusual color, foul smell, dead fish, health concerns, etc.)"
                className={`form-textarea ${errors.concern ? 'input-error' : ''}`}
                rows="6"
              />
              {errors.concern && <span className="error-message">{errors.concern}</span>}
              <p className="form-hint">
                Character count: {formData.concern.length} (minimum 20 characters required)
              </p>
            </div>

            {errors.submit && (
              <div className="error-message submit-error">{errors.submit}</div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <span className="submit-icon">📤</span>
                    Submit Emergency Request
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="form-footer">
            <p className="footer-note">
              <strong>Note:</strong> Emergency requests are processed within 24-48 hours. 
              For immediate health emergencies, please contact local health authorities.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default EmergencyRequest

