"""
FastAPI backend for AWARE ML Model Prediction
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import pandas as pd
import joblib
import os
import subprocess
import threading
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

# Load model on startup (for ML prediction API)
ML_MODEL_PATH = Path(__file__).parent.parent / "extract" / "rf_water_model.joblib"
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
    
    if not ML_MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {ML_MODEL_PATH}. Please train the model first.")
    
    try:
        model_data = joblib.load(ML_MODEL_PATH)
        
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

        print(f"✅ Model loaded successfully from {ML_MODEL_PATH}")
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

# Sensor and graph control state
synthetic_sensor = None
sensor_running = False
graph_process = None
graph_running = False

# Get the project root directory (parent of backend)
BACKEND_DIR = Path(__file__).parent.absolute()
PROJECT_ROOT = BACKEND_DIR.parent
EXTRACT_DIR = PROJECT_ROOT / "extract"
SENSOR_DATA_FILE = EXTRACT_DIR / "sensor_live_data.csv"
GRAPH_SCRIPT = EXTRACT_DIR / "run_live_graph.py"

# Print paths for debugging
print(f"Backend directory: {BACKEND_DIR}")
print(f"Project root: {PROJECT_ROOT}")
print(f"Extract directory: {EXTRACT_DIR}")
print(f"Extract directory exists: {EXTRACT_DIR.exists()}")

# Import SyntheticSensor class directly
import sys
sys.path.insert(0, str(EXTRACT_DIR))
SENSOR_MODEL_PATH = EXTRACT_DIR / "rf_forecast_model.joblib"
DATA_PATH = EXTRACT_DIR / "water_dataX.csv"
SyntheticSensor = None

try:
    from synthetic_sensors import SyntheticSensor
    print(f"Sensor model path: {SENSOR_MODEL_PATH}")
    print(f"Sensor model exists: {SENSOR_MODEL_PATH.exists()}")
    print(f"Data path: {DATA_PATH}")
    print(f"Data exists: {DATA_PATH.exists()}")
except ImportError as e:
    print(f"Warning: Could not import SyntheticSensor: {e}")
    import traceback
    traceback.print_exc()
    SyntheticSensor = None

@app.post("/api/sensors/start")
async def start_sensors():
    """Start synthetic sensors"""
    global synthetic_sensor, sensor_running
    
    # Check if already running
    if sensor_running and synthetic_sensor is not None and synthetic_sensor.is_running:
        return {"status": "already_running", "message": "Sensors are already running"}
    
    if SyntheticSensor is None:
        raise HTTPException(status_code=503, detail="SyntheticSensor class not available. Check backend logs.")
    
    # Validate required files exist with better error messages
    if not SENSOR_MODEL_PATH.exists():
        abs_path = SENSOR_MODEL_PATH.absolute()
        raise HTTPException(
            status_code=404, 
            detail=f"Model file not found at: {abs_path}. Please ensure rf_forecast_model.joblib exists in the extract directory."
        )
    
    # Check data file (optional - sensor can use defaults)
    if not DATA_PATH.exists():
        print(f"⚠️  Warning: Data file not found at {DATA_PATH.absolute()}. Sensor will use default value ranges.")
    
    try:
        # Create and start sensor instance
        synthetic_sensor = SyntheticSensor(SENSOR_MODEL_PATH, DATA_PATH, SENSOR_DATA_FILE)
        synthetic_sensor.start()
        
        # Verify it actually started
        if not synthetic_sensor.is_running:
            raise Exception("Sensor failed to start - is_running is False")
        
        sensor_running = True
        
        return {"status": "started", "message": "Synthetic sensors started successfully"}
    except FileNotFoundError as e:
        sensor_running = False
        synthetic_sensor = None
        error_msg = f"Required file not found: {str(e)}"
        print(f"Error starting sensors: {error_msg}")
        print(f"  Model path: {SENSOR_MODEL_PATH.absolute()}")
        print(f"  Data path: {DATA_PATH.absolute()}")
        print(f"  Sensor data path: {SENSOR_DATA_FILE.absolute()}")
        raise HTTPException(status_code=404, detail=error_msg)
    except Exception as e:
        sensor_running = False
        synthetic_sensor = None
        error_msg = str(e)
        print(f"Error starting sensors: {error_msg}")
        print(f"  Model path: {SENSOR_MODEL_PATH.absolute()}")
        print(f"  Data path: {DATA_PATH.absolute()}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to start sensors: {error_msg}")

@app.post("/api/sensors/stop")
async def stop_sensors():
    """Stop synthetic sensors"""
    global synthetic_sensor, sensor_running
    
    if not sensor_running:
        return {"status": "not_running", "message": "Sensors are not running"}
    
    try:
        if synthetic_sensor:
            synthetic_sensor.stop()
        sensor_running = False
        synthetic_sensor = None
        return {"status": "stopped", "message": "Synthetic sensors stopped successfully"}
    except Exception as e:
        sensor_running = False
        synthetic_sensor = None
        error_msg = str(e)
        print(f"Error stopping sensors: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Failed to stop sensors: {error_msg}")

@app.get("/api/sensors/status")
async def get_sensor_status():
    """Get sensor status"""
    global sensor_running, synthetic_sensor
    is_running = sensor_running and synthetic_sensor is not None and synthetic_sensor.is_running
    return {"running": is_running}

@app.post("/api/graph/start")
async def start_live_graph():
    """Start live graph visualization"""
    global graph_process, graph_running
    
    if graph_running:
        return {"status": "already_running", "message": "Live graph is already running"}
    
    try:
        graph_process = subprocess.Popen(
            ["python", str(GRAPH_SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(EXTRACT_DIR)
        )
        graph_running = True
        return {"status": "started", "message": "Live graph started successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start live graph: {str(e)}")

@app.post("/api/graph/stop")
async def stop_live_graph():
    """Stop live graph visualization"""
    global graph_process, graph_running
    
    if not graph_running:
        return {"status": "not_running", "message": "Live graph is not running"}
    
    try:
        if graph_process:
            graph_process.terminate()
            graph_process.wait(timeout=5)
        graph_running = False
        return {"status": "stopped", "message": "Live graph stopped successfully"}
    except Exception as e:
        graph_running = False
        raise HTTPException(status_code=500, detail=f"Failed to stop live graph: {str(e)}")

@app.get("/api/graph/status")
async def get_graph_status():
    """Get graph status"""
    global graph_running
    return {"running": graph_running}

@app.get("/api/sensor-data")
async def get_sensor_data():
    """Get latest sensor data from CSV"""
    try:
        sensor_data_file = EXTRACT_DIR / "sensor_live_data.csv"
        if not sensor_data_file.exists():
            return {"data": [], "message": "No sensor data available yet"}
        
        df = pd.read_csv(sensor_data_file)
        # Return last 50 readings
        latest_data = df.tail(50).to_dict('records')
        return {"data": latest_data, "count": len(latest_data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read sensor data: {str(e)}")

@app.get("/api/graph/image")
async def get_graph_image():
    """Get the live graph image"""
    graph_image_file = EXTRACT_DIR / "live_graph.png"
    if not graph_image_file.exists():
        raise HTTPException(status_code=404, detail="Graph image not found. Make sure the live graph is running.")
    return FileResponse(
        graph_image_file,
        media_type="image/png",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

