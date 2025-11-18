"""
FastAPI backend for AWARE ML Model Prediction
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import joblib
import os
from pathlib import Path
from typing import Optional

# Initialize FastAPI app
app = FastAPI(title="AWARE ML Prediction API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model on startup
MODEL_PATH = Path(__file__).parent.parent / "extract" / "rf_water_model.joblib"
model_data = None
model = None
imputer = None
label_encoder = None
features = None
uses_pipeline = False

@app.on_event("startup")
async def load_model():
    """Load the ML model, imputer, and label encoder on startup"""
    global model_data, model, imputer, label_encoder, features, uses_pipeline
    
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Please train the model first.")
    
    try:
        model_data = joblib.load(MODEL_PATH)
        
        if isinstance(model_data, dict):
            # Newer artifact format (recommended)
            if 'model' in model_data:
                model = model_data['model']
                imputer = model_data.get('imputer')
                label_encoder = model_data.get('label_encoder')
                features = model_data.get('features')
                uses_pipeline = False
            elif 'pipeline' in model_data:
                # Backward compatibility for pipeline artifacts
                model = model_data['pipeline']
                imputer = None
                label_encoder = model_data.get('label_encoder')
                features = model_data.get('features')
                uses_pipeline = True
            else:
                raise KeyError("Model artifact must contain either 'model' or 'pipeline'.")
        else:
            # Fallback: assume the entire object is a trained estimator/pipeline
            model = model_data
            imputer = None
            label_encoder = getattr(model_data, 'label_encoder_', None)
            features = getattr(model_data, 'feature_names_in_', None)
            uses_pipeline = True

        if label_encoder is None or features is None:
            raise ValueError("Model artifact missing required keys: 'label_encoder' and/or 'features'.")

        print(f"✅ Model loaded successfully from {MODEL_PATH}")
        print(f"   Features: {features}")
        print(f"   Classes: {label_encoder.classes_}")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        raise

# Pydantic model for request validation
class WaterQualityInput(BaseModel):
    Temp: float = Field(..., description="Temperature in °C", ge=0, le=100)
    DO: float = Field(..., description="Dissolved Oxygen in mg/L", ge=0, le=50)
    pH: float = Field(..., description="pH Level", ge=0, le=14)
    Conductivity: float = Field(..., description="Conductivity in µmhos/cm", ge=0)
    BOD: float = Field(..., description="Biological Oxygen Demand in mg/L", ge=0)
    Nitrate: float = Field(..., description="Nitrate in mg/L", ge=0)
    FecalColiform: float = Field(..., description="Fecal Coliform in MPN/100ml", ge=0)
    TotalColiform: float = Field(..., description="Total Coliform in MPN/100ml", ge=0)
    
    class Config:
        # Allow extra fields to be ignored
        extra = "ignore"
        json_schema_extra = {
            "example": {
                "Temp": 29.5,
                "DO": 5.8,
                "pH": 7.2,
                "Conductivity": 150,
                "BOD": 2.0,
                "Nitrate": 0.5,
                "FecalColiform": 120,
                "TotalColiform": 900
            }
        }

# Pydantic model for response
class PredictionResponse(BaseModel):
    riskLevel: str
    riskScore: Optional[float] = None
    confidence: Optional[float] = None
    message: str

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AWARE ML Prediction API",
        "status": "running",
        "model_loaded": model is not None,
        "endpoints": {
            "predict": "/api/predict",
            "health": "/health",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "features": features if features else None
    }

@app.post("/api/predict", response_model=PredictionResponse)
async def predict_risk(input_data: WaterQualityInput):
    """
    Predict water quality risk level based on input parameters
    
    Returns:
    - riskLevel: Low, Medium, or High
    - riskScore: Optional risk score (0-100)
    - confidence: Optional prediction confidence
    """
    # Debug: print received data
    try:
        input_dict = input_data.model_dump() if hasattr(input_data, 'model_dump') else input_data.dict()
        print(f"✅ Received valid prediction request: {input_dict}")
    except Exception as e:
        print(f"❌ Error processing input: {e}")
    
    if model is None or label_encoder is None or features is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please check server logs."
        )
    
    try:
        # Convert input to dictionary
        input_dict = input_data.model_dump() if hasattr(input_data, 'model_dump') else input_data.dict()
        
        # Create DataFrame with the input data
        x_new = pd.DataFrame([input_dict])
        
        # Ensure columns are in the correct order and include all required features
        x_new = x_new.reindex(columns=features)
        
        if imputer is not None and not uses_pipeline:
            # Legacy artifact: impute manually before feeding raw model
            x_new_imputed = imputer.transform(x_new)
            x_ready = pd.DataFrame(x_new_imputed, columns=features, index=x_new.index)
        else:
            # Pipeline-based artifact handles preprocessing itself
            x_ready = x_new
        
        # Make prediction
        prediction = model.predict(x_ready)
        
        # Try to derive readable predicted label
        try:
            risk_level = label_encoder.inverse_transform(prediction)[0]
        except Exception:
            risk_level = prediction[0]

        # Probabilities / confidence / risk score
        probabilities = None
        confidence = None
        risk_score = None
        DEFAULT_SCORE_MAP = {'Low': 0.0, 'Medium': 50.0, 'High': 100.0}

        if hasattr(model, 'predict_proba'):
            probs = None
            try:
                probs = model.predict_proba(x_ready)[0]
            except Exception:
                try:
                    clf = getattr(model, 'named_steps', {}).get('clf', model)
                    X_for_clf = x_ready
                    if hasattr(model, 'named_steps') and 'preproc' in model.named_steps:
                        X_for_clf = model.named_steps['preproc'].transform(x_ready)
                    probs = clf.predict_proba(X_for_clf)[0]
                except Exception:
                    probs = None

            if probs is not None:
                probabilities = probs
                if hasattr(model, 'classes_'):
                    model_classes = model.classes_
                    try:
                        readable_classes = label_encoder.inverse_transform(model_classes)
                    except Exception:
                        readable_classes = [str(c) for c in model_classes]
                else:
                    readable_classes = [str(c) for c in label_encoder.classes_]

                score_map = DEFAULT_SCORE_MAP
                scores = [score_map.get(str(lbl), 50.0) for lbl in readable_classes]
                risk_score_val = float(sum(p * s for p, s in zip(probabilities, scores)))
                confidence = float(max(probabilities)) * 100.0
                risk_score = round(risk_score_val, 2)
                confidence = round(confidence, 2)
            else:
                probabilities = None
                confidence = None
                risk_score = float(DEFAULT_SCORE_MAP.get(str(risk_level), 50.0))
        else:
            probabilities = None
            confidence = None
            risk_score = float(DEFAULT_SCORE_MAP.get(str(risk_level), 50.0))
        
        return PredictionResponse(
            riskLevel=risk_level,
            riskScore=risk_score,
            confidence=confidence,
            message=f"Prediction successful: {risk_level} risk level"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

