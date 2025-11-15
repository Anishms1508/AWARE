# 🚀 AWARE Setup Guide

Complete step-by-step guide to get the AWARE Waterborne Disease Predictor up and running.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** - v18.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify: `node --version`
  
- **npm** - v9.0.0 or higher (comes with Node.js)
  - Verify: `npm --version`

- **Python** - 3.8 or higher
  - Download from [python.org](https://www.python.org/downloads/)
  - Verify: `python --version` or `python3 --version`

- **pip** - Python package manager (usually comes with Python)
  - Verify: `pip --version` or `pip3 --version`

### Optional but Recommended

- **Git** - For cloning the repository
- **Jupyter Notebook** - For training/retraining the ML model
  - Install: `pip install jupyter notebook`

---

## 🎯 Quick Start (TL;DR)

```bash
# 1. Install frontend dependencies
npm install

# 2. Set up environment variables
# Create .env.local with VITE_CLERK_PUBLISHABLE_KEY

# 3. Set up backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# 4. Train ML model (if not already done)
# Run extract/AWARE_random_forest_updated.ipynb

# 5. Start backend (Terminal 1)
cd backend
python main.py

# 6. Start frontend (Terminal 2)
npm run dev
```

---

## 📦 Step 1: Install Frontend Dependencies

### Option A: Use Installation Script (Recommended)

**Windows:**
```bash
install.bat
```

**Linux/Mac:**
```bash
chmod +x install.sh
./install.sh
```

### Option B: Manual Installation

```bash
npm install
```

This will install all dependencies listed in `package.json`:
- React 19
- Vite
- Clerk React SDK
- React Router
- And other required packages

**Verification:**
```bash
# Check if node_modules folder exists
ls node_modules  # Linux/Mac
dir node_modules  # Windows

# Or verify specific packages
npm list react react-dom
```

---

## 🔑 Step 2: Set Up Environment Variables

### Create `.env.local` File

1. In the root directory of the project, create a new file named `.env.local`
   - **Windows:** Right-click → New → Text Document → Rename to `.env.local`
   - **Linux/Mac:** `touch .env.local`

2. Add your Clerk Publishable Key:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

**Important Notes:**
- ⚠️ Vite requires the `VITE_` prefix for environment variables to be exposed to the client
- Use `.env.local` for local development (it's gitignored by default)
- `CLERK_SECRET_KEY` is optional for frontend-only apps
- Never commit `.env.local` to version control

---

## 🔐 Step 3: Get Your Clerk Key

### Create Clerk Account

1. Go to [clerk.com](https://clerk.com) and sign up (free tier available)
2. Create a new application
3. Choose your preferred authentication methods

### Configure Google OAuth

1. In your Clerk dashboard, go to **"User & Authentication"** → **"Social Connections"**
2. Enable **Google** OAuth provider
3. Follow the setup instructions to configure Google OAuth credentials

### Get Your Publishable Key

1. In the Clerk dashboard, go to **"API Keys"**
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Paste it into your `.env.local` file

---

## 🌐 Step 4: Configure Clerk Redirect URLs

### Development Environment

1. In your Clerk dashboard, go to **"Paths"** or **"Redirect URLs"**
2. Add the following URLs:
   - `http://localhost:5173` (default Vite dev server)
   - `http://localhost:5173/*` (for all routes)

### Production Environment

When deploying, add your production URL:
- `https://yourdomain.com`
- `https://yourdomain.com/*`

---

## 🐍 Step 5: Set Up FastAPI Backend

### 5.1 Navigate to Backend Directory

```bash
cd backend
```

### 5.2 Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### 5.3 Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI (0.115.0)
- Uvicorn (0.32.0)
- Pandas (2.2.3)
- Scikit-learn (1.5.2)
- Joblib (1.4.2)
- Pydantic (2.9.2)
- Python-multipart (0.0.12)

**Verification:**
```bash
pip list
# Should show all packages from requirements.txt
```

### 5.4 Train the ML Model (If Not Already Done)

1. Open the Jupyter notebook: `extract/AWARE_random_forest_updated.ipynb`
2. Run all cells to train the model
3. The model will be saved to: `extract/rf_water_model.joblib`

**Note:** If the model file already exists, you can skip this step.

### 5.5 Start the Backend Server

**Option A: Using Python directly**
```bash
python main.py
```

**Option B: Using start script**

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Expected Output:**
```
✅ Model loaded successfully!
✅ Imputer loaded successfully!
✅ Label encoder loaded successfully!
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

The API will be available at:
- **API Base URL:** `http://localhost:8000`
- **API Documentation:** `http://localhost:8000/docs` (Interactive Swagger UI)
- **Health Check:** `http://localhost:8000/health`

**Verify Backend is Running:**
```bash
# Test health endpoint
curl http://localhost:8000/health

# Or visit in browser
# http://localhost:8000/health
```

---

## 🚀 Step 6: Run the Development Server

### Start the Frontend

In a **new terminal** (keep the backend running in the first terminal):

```bash
# Make sure you're in the project root directory
npm run dev
```

**Expected Output:**
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

The application will open at `http://localhost:5173`

---

## ✅ Verification Checklist

Use this checklist to verify your setup:

### Frontend Setup
- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm v9+ installed (`npm --version`)
- [ ] Dependencies installed (`node_modules` folder exists)
- [ ] `.env.local` file created with Clerk key
- [ ] Clerk application configured with Google OAuth
- [ ] Redirect URLs set in Clerk dashboard (`http://localhost:5173`)
- [ ] Development server starts without errors

### Backend Setup
- [ ] Python 3.8+ installed (`python --version`)
- [ ] Virtual environment created and activated
- [ ] Python dependencies installed (`pip list` shows all packages)
- [ ] ML model file exists (`extract/rf_water_model.joblib`)
- [ ] Backend server starts without errors
- [ ] Health check endpoint responds (`http://localhost:8000/health`)
- [ ] API documentation accessible (`http://localhost:8000/docs`)

### Integration
- [ ] Both frontend and backend are running simultaneously
- [ ] Can access dashboard at `http://localhost:5173/dashboard`
- [ ] Can make predictions (form submits successfully)
- [ ] Predictions return results from ML model

---

## 🔧 Common Issues & Troubleshooting

### Frontend Issues

#### "Missing Publishable Key" Error

**Symptoms:**
- Console shows: `⚠️ Clerk Publishable Key is missing`
- Authentication doesn't work

**Solutions:**
1. Verify `.env.local` file exists in the root directory
2. Check the key starts with `pk_test_` or `pk_live_`
3. Ensure the key is on a single line (no line breaks)
4. Restart the dev server after creating/updating `.env`
5. Clear browser cache and hard refresh (Ctrl+Shift+R)

#### Port 5173 Already in Use

**Symptoms:**
- Error: `Port 5173 is already in use`

**Solutions:**
```bash
# Option 1: Use a different port
npm run dev -- --port 3000

# Option 2: Kill the process using port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:5173 | xargs kill -9
```

#### Module Not Found Errors

**Symptoms:**
- `Error: Cannot find module 'xxx'`
- Import errors in console

**Solutions:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json  # Linux/Mac
rmdir /s node_modules  # Windows
del package-lock.json  # Windows

npm install
```

#### Dependencies Installation Fails

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Use specific Node version (if using nvm)
nvm use 18

# Try with legacy peer deps
npm install --legacy-peer-deps
```

### Backend Issues

#### Model File Not Found

**Symptoms:**
- `FileNotFoundError: [Errno 2] No such file or directory: 'rf_water_model.joblib'`

**Solutions:**
1. Train the model using `extract/AWARE_random_forest_updated.ipynb`
2. Verify the model file exists: `extract/rf_water_model.joblib`
3. Check the path in `backend/main.py` matches your file location

#### Python Package Installation Fails

**Symptoms:**
- `pip install` errors
- Import errors when running backend

**Solutions:**
```bash
# Upgrade pip first
python -m pip install --upgrade pip

# Install with verbose output
pip install -r requirements.txt -v

# Try installing packages individually
pip install fastapi uvicorn pandas scikit-learn joblib pydantic
```

#### Port 8000 Already in Use

**Symptoms:**
- `Address already in use` error

**Solutions:**
```bash
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:8000 | xargs kill -9

# Or change port in main.py
# uvicorn.run(app, host="0.0.0.0", port=8001)
```

#### Virtual Environment Issues

**Symptoms:**
- `python: command not found`
- Packages not found even after installation

**Solutions:**
```bash
# Make sure venv is activated (you should see (venv) in prompt)
# Windows:
venv\Scripts\activate

# Linux/Mac:
source venv/bin/activate

# Verify Python path
which python  # Linux/Mac
where python  # Windows
```

### Integration Issues

#### "Failed to connect to ML API" Error

**Symptoms:**
- Dashboard shows connection error
- Predictions fail with network error

**Solutions:**
1. Verify backend is running: `http://localhost:8000/health`
2. Check CORS settings in `backend/main.py`
3. Verify API endpoint in `src/components/Dashboard.jsx`: `http://localhost:8000/api/predict`
4. Check browser console for detailed error messages
5. Ensure both servers are running simultaneously

#### 422 Unprocessable Content Error

**Symptoms:**
- API returns 422 validation error
- Predictions fail with validation message

**Solutions:**
1. Check browser console for validation details
2. Verify all form fields are filled with valid numbers
3. Ensure no NaN or negative values are sent
4. Check backend logs for received data
5. Verify field names match between frontend and backend

#### CORS Errors

**Symptoms:**
- `Access to fetch at 'http://localhost:8000' from origin 'http://localhost:5173' has been blocked by CORS policy`

**Solutions:**
1. Verify CORS is enabled in `backend/main.py`:
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   app.add_middleware(CORSMiddleware, allow_origins=["*"])
   ```
2. Restart the backend server after changes

---

## 🎯 Next Steps

Once everything is set up and running:

1. ✅ **Visit the Landing Page**
   - Go to `http://localhost:5173`
   - You should see the AWARE landing page

2. ✅ **Test Authentication** (if Clerk is configured)
   - Click "Sign in with Google"
   - Complete OAuth flow
   - You should be redirected to the dashboard

3. ✅ **Explore the Dashboard**
   - Navigate to `http://localhost:5173/dashboard`
   - View the prediction form and statistics

4. ✅ **Test Predictions**
   - Fill in all water quality parameters
   - Click "Predict Risk"
   - Verify you get a prediction result with risk level and recommendations

5. ✅ **Check API Documentation**
   - Visit `http://localhost:8000/docs`
   - Test the `/api/predict` endpoint directly
   - View request/response schemas

---

## 📚 Additional Resources

- **Main README:** [README.md](README.md) - Project overview and features
- **Dependencies:** [DEPENDENCIES.md](DEPENDENCIES.md) - Detailed dependency information
- **Backend README:** [backend/README.md](backend/README.md) - Backend-specific documentation
- **Navigation Guide:** [NAVIGATION_GUIDE.md](NAVIGATION_GUIDE.md) - Project structure overview

---

## 🆘 Getting Help

If you encounter issues not covered here:

1. **Check the logs:**
   - Browser console (F12 → Console tab)
   - Backend terminal output
   - Frontend terminal output

2. **Verify your setup:**
   - Run through the verification checklist above
   - Ensure all prerequisites are met

3. **Search for similar issues:**
   - Check GitHub issues
   - Search Stack Overflow
   - Review FastAPI/React documentation

4. **Create an issue:**
   - Include error messages
   - Provide steps to reproduce
   - Share relevant logs
   - Mention your OS and versions

---

## 🎉 Success!

If you've completed all steps and verified everything works, congratulations! You now have:

- ✅ Frontend React app running on `http://localhost:5173`
- ✅ FastAPI backend running on `http://localhost:8000`
- ✅ ML model integrated and ready for predictions
- ✅ Authentication configured (if using Clerk)

Happy coding! 🚀
