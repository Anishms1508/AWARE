/**
 * Gemini API Service for generating disease predictions and recommendations
 * Using modern @google/genai SDK
 */

import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.5-flash' // Using Gemini 2.5 Flash (fast and efficient model)
const FALLBACK_MODEL = 'gemini-2.5-flash-lite' // Fallback model

// Initialize the Google GenAI client
let ai = null
if (GEMINI_API_KEY) {
  try {
    console.log('🔵 [Gemini] Initializing Google GenAI client...')
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    console.log('✅ [Gemini] Client initialized successfully')
  } catch (error) {
    console.error('❌ [Gemini] Failed to initialize Google GenAI:', error)
  }
} else {
  console.warn('⚠️ [Gemini] API key not found. Set VITE_GEMINI_API_KEY in environment variables.')
}

/**
 * Fallback function to try alternative Gemini model if primary model is unavailable
 */
async function tryFallbackModel(predictionData, prompt) {
  if (!ai) {
    throw new Error('Gemini API client not initialized')
  }

  try {
    console.log(`🔄 [Gemini] Trying fallback model: ${FALLBACK_MODEL}`)
    const response = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt
    })

    console.log('📥 [Gemini] Fallback response received:', response)
    const responseText = response.text || ''
    console.log('📝 [Gemini] Fallback response text length:', responseText.length)
    console.log('📝 [Gemini] Fallback response text preview:', responseText.substring(0, 200))
    
    if (!responseText) {
      throw new Error('No response from fallback model')
    }

    const parsed = parseGeminiResponse(responseText, predictionData.riskLevel)
    console.log('✅ [Gemini] Fallback response parsed successfully:', parsed)
    return parsed
  } catch (error) {
    console.error('❌ [Gemini] Fallback model error:', error)
    throw error
  }
}

/**
 * Parse Gemini response and extract diseases and recommendations
 */
function parseGeminiResponse(responseText, riskLevel) {
  try {
    console.log('🔍 [Gemini] Parsing response...')
    console.log('📄 [Gemini] Raw response text:', responseText)
    
    let jsonText = responseText.trim()
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    console.log('🧹 [Gemini] Cleaned JSON text:', jsonText.substring(0, 300))
    
    // Try to extract JSON object if there's extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
      console.log('✂️ [Gemini] Extracted JSON:', jsonText.substring(0, 300))
    }

    const parsed = JSON.parse(jsonText)
    console.log('✅ [Gemini] JSON parsed successfully:', parsed)
    
    // Validate and enforce limits
    const diseases = Array.isArray(parsed.diseases) 
      ? parsed.diseases.slice(0, 3) // Max 3 diseases
      : []
    const recommendations = Array.isArray(parsed.recommendations) 
      ? parsed.recommendations.slice(0, 4) // Max 4 recommendations
      : []

    console.log('📊 [Gemini] Final parsed data:', { diseases, recommendations })

    return {
      diseases: diseases.length > 0 ? diseases : getFallbackDiseases(riskLevel),
      recommendations: recommendations.length > 0 ? recommendations : getFallbackRecommendations(riskLevel)
    }
  } catch (parseError) {
    console.error('❌ [Gemini] Error parsing response:', parseError)
    console.error('❌ [Gemini] Response text that failed to parse:', responseText)
    throw new Error(`Failed to parse Gemini response: ${parseError.message}`)
  }
}

/**
 * Generate diseases and recommendations using Gemini API based on water quality data
 * @param {Object} predictionData - Water quality parameters and ML prediction results
 * @returns {Promise<{diseases: string[], recommendations: string[]}>}
 */
export const generateDiseaseAnalysis = async (predictionData) => {
  console.log('🚀 [Gemini] generateDiseaseAnalysis called with data:', predictionData)
  
  if (!GEMINI_API_KEY) {
    console.error('❌ [Gemini] API key not configured')
    throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.')
  }

  if (!ai) {
    console.error('❌ [Gemini] Client not initialized')
    throw new Error('Gemini API client not initialized. Please check your API key.')
  }

  console.log('✅ [Gemini] Client ready, proceeding with API call...')

  const {
    riskLevel,
    riskScore,
    temperature,
    do: dissolvedOxygen,
    ph,
    conductivity,
    bod,
    nitrate,
    fecalColiform,
    totalColiform,
    location,
    waterSource
  } = predictionData

  // Construct prompt for Gemini
  const prompt = `You are a water quality and public health expert with access to historical water quality data and disease outbreak records. Analyze the following water quality test results and provide predictions based ONLY on the input data provided, matching similar cases from past records.

Water Quality Test Data:
- Location: ${location || 'Unknown'}
- Water Source: ${waterSource || 'Unknown'}
- Temperature: ${temperature}°C
- Dissolved Oxygen (DO): ${dissolvedOxygen} mg/L
- pH Level: ${ph}
- Conductivity: ${conductivity} µmhos/cm
- BOD (Biological Oxygen Demand): ${bod} mg/L
- Nitrate: ${nitrate} mg/L
- Fecal Coliform: ${fecalColiform} MPN/100ml
- Total Coliform: ${totalColiform} MPN/100ml

ML Model Assessment:
- Risk Level: ${riskLevel}
- Risk Score: ${riskScore}%

CRITICAL INSTRUCTIONS:
1. FIRST, check if the water quality parameters meet WHO (World Health Organization) safe drinking water standards. If ALL parameters are within WHO safe limits, return NO diseases and simple positive recommendations.
2. Generate predictions STRICTLY based on the provided water quality parameters above. Base predictions on similar historical cases with matching parameter ranges.
3. Match these specific parameter values against known historical records of water quality issues and associated disease outbreaks.
4. Provide the MOST LIKELY diseases based on these exact parameter combinations from past documented cases.
5. Generate SIMPLE, EASY-TO-UNDERSTAND recommendations for general people (non-technical audience). Keep language simple and actionable.

REQUIREMENTS:
- If water is SAFE by WHO standards: Return empty diseases array [] and simple positive recommendations like "Water quality is safe", "Continue regular monitoring", etc.
- Maximum 3 diseases (list only the most probable based on matching parameter patterns). If safe, return empty array.
- Maximum 4 recommendations (prioritize the most critical actions for these specific parameter values)
- Recommendations must be SIMPLE and for GENERAL PUBLIC - avoid technical jargon, complex procedures, or scientific terms
- Use everyday language that anyone can understand and follow
- Base predictions on documented cases with similar water quality profiles
- Be precise and data-driven, not speculative

Return the response in this EXACT JSON format (no additional text):
{
  "diseases": ["Disease Name 1", "Disease Name 2", "Disease Name 3"],
  "recommendations": ["Action 1", "Action 2", "Action 3", "Action 4"]
}

IMPORTANT: If water is safe by WHO standards, return:
{
  "diseases": [],
  "recommendations": ["Water quality is safe for drinking", "Continue regular monitoring", "Maintain good water storage practices", "Report any changes in water appearance or taste"]
}`

  let useFallback = false
  
  try {
    // Try primary model first
    try {
      console.log(`📤 [Gemini] Sending request to primary model: ${GEMINI_MODEL}`)
      console.log('📋 [Gemini] Prompt length:', prompt.length)
      console.log('📋 [Gemini] Prompt preview:', prompt.substring(0, 200))
      
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      })

      console.log('📥 [Gemini] Primary model response received:', response)
      console.log('📥 [Gemini] Response type:', typeof response)
      console.log('📥 [Gemini] Response keys:', Object.keys(response || {}))

      // Handle response - check if it's a string or has a text property
      const responseText = typeof response === 'string' ? response : (response.text || response.response?.text || '')
      console.log('📝 [Gemini] Extracted response text length:', responseText.length)
      console.log('📝 [Gemini] Response text preview:', responseText.substring(0, 300))
      
      if (!responseText) {
        console.error('❌ [Gemini] No response text found in response object')
        throw new Error('No response from Gemini API')
      }

      // Parse and return the response
      const result = parseGeminiResponse(responseText, riskLevel)
      console.log('✅ [Gemini] Primary model success! Result:', result)
      return result
    } catch (modelError) {
      console.warn(`⚠️ [Gemini] Primary model ${GEMINI_MODEL} failed:`, modelError)
      console.warn(`🔄 [Gemini] Trying fallback model...`)
      useFallback = true
      
      // Try fallback model
      console.log(`📤 [Gemini] Sending request to fallback model: ${FALLBACK_MODEL}`)
      const response = await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: prompt
      })

      console.log('📥 [Gemini] Fallback model response received:', response)
      console.log('📥 [Gemini] Response type:', typeof response)
      console.log('📥 [Gemini] Response keys:', Object.keys(response || {}))

      // Handle response - check if it's a string or has a text property
      const responseText = typeof response === 'string' ? response : (response.text || response.response?.text || '')
      console.log('📝 [Gemini] Fallback response text length:', responseText.length)
      console.log('📝 [Gemini] Fallback response text preview:', responseText.substring(0, 300))
      
      if (!responseText) {
        console.error('❌ [Gemini] No response text found in fallback response')
        throw new Error('No response from fallback model')
      }

      const result = parseGeminiResponse(responseText, riskLevel)
      console.log('✅ [Gemini] Fallback model success! Result:', result)
      return result
    }

  } catch (error) {
    console.error('❌ [Gemini] API error occurred:', error)
    console.error('❌ [Gemini] Error message:', error.message)
    console.error('❌ [Gemini] Error stack:', error.stack)
    
    // Try fallback model if primary fails and we haven't already tried it
    const errorMessage = error.message || ''
    if (!useFallback && (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('model'))) {
      console.warn('🔄 [Gemini] Primary model failed, trying fallback model...')
      try {
        const fallbackResult = await tryFallbackModel(predictionData, prompt)
        console.log('✅ [Gemini] Fallback model succeeded!')
        return fallbackResult
      } catch (fallbackError) {
        console.error('❌ [Gemini] Fallback model also failed:', fallbackError)
      }
    }
    
    // Return fallback data if all API calls fail
    console.warn('⚠️ [Gemini] Using fallback data (hardcoded recommendations)')
    const fallbackData = {
      diseases: getFallbackDiseases(riskLevel),
      recommendations: getFallbackRecommendations(riskLevel),
      error: error.message
    }
    console.log('📋 [Gemini] Fallback data:', fallbackData)
    return fallbackData
  }
}

/**
 * Fallback diseases if Gemini API fails (max 3 diseases)
 * Returns empty array as extended analysis is unavailable
 */
function getFallbackDiseases(riskLevel) {
  // Extended analysis unavailable - return empty array
  return []
}

/**
 * Fallback recommendations if Gemini API fails (max 4 recommendations)
 * Returns general tips when extended analysis is unavailable
 */
function getFallbackRecommendations(riskLevel) {
  return [
    'Boil water before drinking',
    'Monitor and report water quality regularly',
    'Use water filters or purification systems when available',
    'Contact local health authorities if water quality concerns persist'
  ].slice(0, 4) // Max 4
}
