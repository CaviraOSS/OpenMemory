# Deployment Guide for Nyomi AI

This guide covers deploying Nyomi AI to various platforms.

## Table of Contents
- [Vercel Deployment](#vercel-deployment)
- [Render Deployment](#render-deployment)
- [Replit Deployment](#replit-deployment)
- [Railway Deployment](#railway-deployment)
- [Heroku Deployment](#heroku-deployment)

---

## Vercel Deployment

Vercel is ideal for deploying both frontend and backend (as serverless functions).

### Backend Deployment

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure:
     - **Root Directory**: `backend`
     - **Build Command**: `npm install`
     - **Output Directory**: Leave empty
   - Add Environment Variables:
     - `OPENAI_API_KEY`: Your OpenAI API key
   - Click "Deploy"

3. **Note your backend URL** (e.g., `https://your-app.vercel.app`)

### Frontend Deployment

1. **Deploy Frontend**
   - Import the same repository again
   - Configure:
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `build`
   - Add Environment Variables:
     - `REACT_APP_API_URL`: Your backend URL from step 3
   - Click "Deploy"

---

## Render Deployment

Render provides free hosting for web services and static sites.

### Backend Deployment

1. **Create Web Service**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `nyomi-ai-backend`
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
   - Add Environment Variables:
     - `OPENAI_API_KEY`: Your OpenAI API key
   - Click "Create Web Service"

2. **Note your backend URL** (e.g., `https://nyomi-ai-backend.onrender.com`)

### Frontend Deployment

1. **Create Static Site**
   - Click "New +" → "Static Site"
   - Connect your repository
   - Configure:
     - **Name**: `nyomi-ai-frontend`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `build`
   - Add Environment Variables:
     - `REACT_APP_API_URL`: Your backend URL
   - Click "Create Static Site"

---

## Replit Deployment

Replit allows you to run both frontend and backend in one environment.

### Setup

1. **Import from GitHub**
   - Go to [replit.com](https://replit.com)
   - Click "Create Repl"
   - Select "Import from GitHub"
   - Enter your repository URL

2. **Configure Environment**
   - Click on "Secrets" (lock icon)
   - Add:
     - `OPENAI_API_KEY`: Your OpenAI API key

3. **Create `.replit` file**
   ```toml
   run = "npm run install-all && npm start"
   
   [env]
   PORT = "5000"
   ```

4. **Create `replit.nix` file**
   ```nix
   { pkgs }: {
     deps = [
       pkgs.nodejs-18_x
       pkgs.nodePackages.npm
     ];
   }
   ```

5. **Click "Run"**
   - Backend will start on port 5000
   - Frontend will start on port 3000
   - Replit will provide a public URL

---

## Railway Deployment

Railway offers simple deployment with automatic HTTPS.

### Backend Deployment

1. **Create New Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Configure Backend**
   - Click on the service
   - Go to "Settings"
   - Set **Root Directory**: `backend`
   - Add Environment Variables:
     - `OPENAI_API_KEY`: Your OpenAI API key
   - Railway will auto-detect Node.js and deploy

3. **Generate Domain**
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Note your backend URL

### Frontend Deployment

1. **Add Frontend Service**
   - Click "New" → "GitHub Repo"
   - Select the same repository
   - Set **Root Directory**: `frontend`
   - Add Environment Variables:
     - `REACT_APP_API_URL`: Your backend URL
   - Generate domain for frontend

---

## Heroku Deployment

Heroku provides easy deployment with Git.

### Backend Deployment

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Windows
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Create Heroku App**
   ```bash
   cd backend
   heroku create nyomi-ai-backend
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set OPENAI_API_KEY=your_api_key_here
   ```

4. **Deploy**
   ```bash
   git init
   git add .
   git commit -m "Deploy backend"
   heroku git:remote -a nyomi-ai-backend
   git push heroku main
   ```

5. **Note your backend URL**
   ```bash
   heroku open
   ```

### Frontend Deployment

1. **Create Frontend App**
   ```bash
   cd ../frontend
   heroku create nyomi-ai-frontend
   ```

2. **Add Buildpack**
   ```bash
   heroku buildpacks:set mars/create-react-app
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set REACT_APP_API_URL=https://nyomi-ai-backend.herokuapp.com
   ```

4. **Deploy**
   ```bash
   git init
   git add .
   git commit -m "Deploy frontend"
   heroku git:remote -a nyomi-ai-frontend
   git push heroku main
   ```

---

## Environment Variables Summary

### Backend
- `OPENAI_API_KEY` (Required): Your OpenAI API key
- `PORT` (Optional): Server port (default: 5000)

### Frontend
- `REACT_APP_API_URL` (Required): Backend API URL

---

## Post-Deployment Checklist

- [ ] Backend is accessible and returns health check
- [ ] Frontend loads without errors
- [ ] Frontend can communicate with backend
- [ ] Chat functionality works end-to-end
- [ ] Environment variables are set correctly
- [ ] HTTPS is enabled (most platforms do this automatically)
- [ ] CORS is configured properly

---

## Testing Deployed Application

### Test Backend
```bash
curl https://your-backend-url.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Nyomi AI backend is running",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

### Test Chat Endpoint
```bash
curl -X POST https://your-backend-url.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

---

## Troubleshooting

### CORS Errors
- Ensure backend has CORS enabled
- Check that frontend is using correct backend URL
- Verify environment variables are set

### API Key Errors
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI account has credits
- Ensure no extra spaces in the key

### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Review build logs for specific errors

### Connection Refused
- Ensure backend is running
- Check firewall settings
- Verify port configuration

---

## Cost Considerations

### Free Tiers
- **Vercel**: Free for personal projects
- **Render**: Free tier available (may sleep after inactivity)
- **Replit**: Free tier with limitations
- **Railway**: $5 free credit monthly
- **Heroku**: Free tier discontinued, starts at $7/month

### OpenAI Costs
- GPT-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Typical conversation: ~$0.001-0.01 per exchange
- Set usage limits in OpenAI dashboard

---

## Security Best Practices

1. **Never commit `.env` files**
2. **Use environment variables** for all secrets
3. **Enable rate limiting** on backend
4. **Set up monitoring** for unusual activity
5. **Regularly rotate API keys**
6. **Use HTTPS** for all deployments
7. **Implement authentication** for production use

---

For more help, refer to the main [README.md](README.md) or open an issue on GitHub.
