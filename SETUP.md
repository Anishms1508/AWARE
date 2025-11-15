# Quick Setup Guide

Follow these steps to get the AWARE project up and running.

## Step 1: Install Dependencies

### Option A: Use the Installation Script (Recommended)

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

This will install all dependencies listed in `package.json`.

## Step 2: Set Up Environment Variables

1. Create a `.env.local` file in the root directory (or use `.env`)

2. Add your Clerk keys:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_secret_key_here
   ```

   **Important:** 
   - Vite requires the `VITE_` prefix for environment variables to be exposed to the client
   - Use `.env.local` for local development (it's gitignored)
   - `CLERK_SECRET_KEY` is only needed for server-side operations (not used in this frontend app)

## Step 3: Get Your Clerk Key

1. Go to [clerk.com](https://clerk.com) and sign up (free tier available)
2. Create a new application
3. Enable Google OAuth provider
4. Copy your Publishable Key from the dashboard
5. Paste it into your `.env` file

## Step 4: Configure Clerk Redirect URLs

In your Clerk dashboard:
1. Go to "Paths" or "Redirect URLs"
2. Add `http://localhost:5173` for development
3. Add your production URL when deploying

## Step 5: Run the Development Server

```bash
npm run dev
```

The application will open at `http://localhost:5173`

## Verification Checklist

- [ ] Dependencies installed (`node_modules` folder exists)
- [ ] `.env` file created with Clerk key
- [ ] Clerk application configured with Google OAuth
- [ ] Redirect URLs set in Clerk dashboard
- [ ] Development server starts without errors

## Common Issues

**"Missing Publishable Key" error:**
- Make sure `.env` file exists in the root directory
- Verify the key starts with `pk_test_` or `pk_live_`
- Restart the dev server after creating/updating `.env`

**Port 5173 already in use:**
- Change the port in `vite.config.js` or use `npm run dev -- --port 3000`

**Module not found errors:**
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then reinstall

## Next Steps

Once the app is running:
1. Visit the landing page
2. Sign in with Google
3. Explore the dashboard
4. Test the prediction features

For more details, see [README.md](README.md) and [DEPENDENCIES.md](DEPENDENCIES.md).

