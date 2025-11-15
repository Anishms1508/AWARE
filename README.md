# AWARE - Waterborne Disease Predictor

A modern web application for predicting and monitoring waterborne diseases using React, Vite, and Clerk authentication.

## Features

- 🔐 **Google Authentication** - Secure login via Clerk with Google OAuth
- 📊 **Real-time Dashboard** - Comprehensive analytics and monitoring interface
- 🔮 **AI Predictions** - Risk assessment for waterborne diseases
- 📈 **Data Visualization** - Interactive charts and statistics
- 🔔 **Alert System** - Real-time notifications for risk levels
- 📱 **Responsive Design** - Works seamlessly on all devices

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Clerk** - Authentication and user management
- **React Router** - Client-side routing

## Getting Started

### Quick Setup

**For detailed setup instructions, see [SETUP.md](SETUP.md)**

**For dependency information, see [DEPENDENCIES.md](DEPENDENCIES.md)**

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Clerk account (free tier available)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd AWARE
```

2. Install dependencies (choose one method):

   **Option A: Use installation script (Recommended)**
   ```bash
   # Windows
   install.bat
   
   # Linux/Mac
   chmod +x install.sh
   ./install.sh
   ```
   
   **Option B: Manual installation**
   ```bash
   npm install
   ```

3. Set up Clerk:
   - Go to [clerk.com](https://clerk.com) and create a free account
   - Create a new application
   - Enable Google OAuth provider
   - Copy your Publishable Key

4. Create environment file (`.env.local` or `.env`):
```bash
# Create .env.local file
```

5. Add your Clerk keys to `.env.local`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

   **Note:** Vite requires the `VITE_` prefix for environment variables. The `CLERK_SECRET_KEY` is optional for frontend-only apps.

6. Configure Clerk Redirect URLs:
   - In your Clerk dashboard, go to "Paths"
   - Add `http://localhost:5173` to allowed redirect URLs
   - Add your production URL when deploying

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

## Project Structure

```
src/
├── components/
│   ├── LandingPage.jsx      # Landing page with authentication
│   ├── LandingPage.css      # Landing page styles
│   ├── Dashboard.jsx        # Main dashboard component
│   └── Dashboard.css        # Dashboard styles
├── App.jsx                  # Main app component with routing
├── App.css                  # Global app styles
├── main.jsx                 # Entry point with Clerk provider
└── index.css                # Base styles
```

## Features Overview

### Landing Page
- Beautiful gradient design
- Google OAuth sign-in
- Feature highlights
- Responsive layout

### Dashboard
- **Prediction Form**: Input water quality parameters
  - Location
  - Water source type
  - Temperature, pH, Turbidity, Chlorine levels
- **Risk Assessment**: Real-time risk scoring
  - Low/Medium/High risk indicators
  - Potential disease identification
  - Actionable recommendations
- **Statistics**: Quick overview metrics
- **Activity Feed**: Recent system activities

## Environment Variables

Create a `.env` file in the root directory:

```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

## Next Steps

To integrate with a real backend API:

1. Replace the mock prediction logic in `Dashboard.jsx` with actual API calls
2. Set up your backend API endpoint
3. Add error handling and loading states
4. Implement real-time data updates
5. Add data persistence

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

