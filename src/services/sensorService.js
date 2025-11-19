/**
 * Service for controlling synthetic sensors and live graph
 */

const API_BASE_URL = 'http://localhost:8000'

export const startSensors = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensors/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to start sensors' }))
      throw new Error(errorData.detail || errorData.message || 'Failed to start sensors')
    }
    return await response.json()
  } catch (error) {
    console.error('Error starting sensors:', error)
    // Handle network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Cannot connect to backend server. Make sure the backend is running on port 8000.')
    }
    throw error
  }
}

export const stopSensors = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensors/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to stop sensors' }))
      throw new Error(errorData.detail || errorData.message || 'Failed to stop sensors')
    }
    return await response.json()
  } catch (error) {
    console.error('Error stopping sensors:', error)
    throw error
  }
}

export const getSensorStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensors/status`)
    if (!response.ok) throw new Error('Failed to get sensor status')
    return await response.json()
  } catch (error) {
    console.error('Error getting sensor status:', error)
    return { running: false }
  }
}

export const startLiveGraph = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/graph/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to start live graph' }))
      throw new Error(errorData.detail || errorData.message || 'Failed to start live graph')
    }
    return await response.json()
  } catch (error) {
    console.error('Error starting live graph:', error)
    throw error
  }
}

export const stopLiveGraph = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/graph/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to stop live graph' }))
      throw new Error(errorData.detail || errorData.message || 'Failed to stop live graph')
    }
    return await response.json()
  } catch (error) {
    console.error('Error stopping live graph:', error)
    throw error
  }
}

export const getGraphStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/graph/status`)
    if (!response.ok) throw new Error('Failed to get graph status')
    return await response.json()
  } catch (error) {
    console.error('Error getting graph status:', error)
    return { running: false }
  }
}

export const getSensorData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensor-data`)
    if (!response.ok) throw new Error('Failed to get sensor data')
    return await response.json()
  } catch (error) {
    console.error('Error getting sensor data:', error)
    return { data: [], count: 0 }
  }
}

export const getGraphImageUrl = () => {
  // Return URL with timestamp to prevent caching
  return `${API_BASE_URL}/api/graph/image?t=${Date.now()}`
}

export const predictWaterQuality = async (data) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Prediction failed')
    }
    return await response.json()
  } catch (error) {
    console.error('Error predicting water quality:', error)
    throw error
  }
}

