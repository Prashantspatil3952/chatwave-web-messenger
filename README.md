# ChatWave — Web Messenger
ChatWave is a web-based messaging application built with a React frontend and an Express backend. It uses MongoDB Atlas for data storage, Brevo for OTP email delivery, and Socket.IO as the foundation for real-time features.

# Project status: Initial application and deployment setup. The backend is configured for Render and the frontend for Vercel. Verify the live application and each authentication flow after deployment.

Features and project scope
Implemented or configured
- React + Vite frontend
- Express.js backend API
- MongoDB Atlas connection
- JWT-based authentication foundation
- OTP email service using the Brevo API
- Registration and password-reset OTP flows in the application code
- Socket.IO server/client foundation
- Environment-based frontend/backend configuration

Planned or requiring end-to-end verification
- Verify registration, OTP delivery, login, logout, and password reset on the deployed website
- Verify conversation and message flows
- Complete and test real-time messaging
- Complete and test voice/video calling using WebRTC
- Review production security settings, rate limits, and deployment behavior

Tech stack
Layer	Technology
Frontend	React, Vite, JavaScript, CSS
Routing	React Router
Backend	Node.js, Express.js
Database	MongoDB Atlas, Mongoose
Authentication	JWT, bcrypt
Email OTP	Brevo API
Real-time foundation	Socket.IO
Frontend hosting	Vercel
Backend hosting	Render
Source control	Git and GitHub

chatwave-web-messenger/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   └── services/
│   ├── package.json
│   └── .env                 # Local only; do not commit
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── App.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── .env.local           # Local only; do not commit
└── README.md

Requirements
- Node.js (a current LTS release is recommended)
- npm
- MongoDB Atlas database and connection string
- Brevo account/API key and verified sender email for OTP messages

Local development
Open two PowerShell terminals from the repository root.
1. Configure the backend
Create backend/.env with your own values:
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_long_random_jwt_secret
OTP_SECRET=your_long_random_otp_secret

BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_verified_sender_email
BREVO_SENDER_NAME=ChatWave Security

Do not use the placeholder values literally. Never commit .env files or publish secrets in screenshots, issues, or chat messages.
Install dependencies and start the backend:

cd backend
npm install
npm run dev

The backend is expected to listen on port 5000 in local development.

Health endpoint:
http://localhost:5000/api/health

A healthy response should indicate that the ChatWave API is running.
2. Configure the frontend
Create frontend/.env.local:
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
Install dependencies and start Vite:
cd frontend
npm install
npm run dev
Open the local URL printed by Vite, usually http://localhost:5173.
Restart Vite after changing environment variables.
Deployment
Backend — Render
Configured service URL:
- https://chatwave-web-messenger.onrender.com
Expected Render configuration:
Setting	Value
Root Directory	backend
Build Command	npm install
Start Command	npm start
Health Check Path, if available	/api/health


Set backend environment variables in Render, not in source control:
- NODE_ENV=production
- CLIENT_URL — the deployed Vercel frontend origin, including https://
- MONGODB_URI
- JWT_SECRET
- OTP_SECRET
- BREVO_API_KEY
- BREVO_SENDER_EMAIL
- BREVO_SENDER_NAME
- PORT — allow Render to supply its port if the platform provides one
Check Render logs after deployment. The service should connect to MongoDB and start listening without errors.
Frontend — Vercel
Expected project configuration:
Setting	Value
Root Directory	frontend
Framework Preset	Vite
Build Command	npm run build
Output Directory	dist


Set these frontend environment variables in Vercel:
VITE_API_URL=https://chatwave-web-messenger.onrender.com/api
VITE_SOCKET_URL=https://chatwave-web-messenger.onrender.com
Redeploy after changing Vercel environment variables. Set Render's CLIENT_URL to the exact Vercel origin, for example https://your-project.vercel.app (without /api). If the frontend domain changes, update CLIENT_URL.
VITE_ variables are included in client-side frontend code. Never put API keys, database credentials, or authentication secrets in frontend environment variables.

Branding
- App name: ChatWave
- Favicon: frontend/public/favicon.svg
- HTML metadata and favicon reference: frontend/index.html
If you change the favicon, ensure frontend/index.html references /favicon.svg.
Useful commands
Run from the relevant project directory:
npm install
npm run dev
npm run build
Check each package.json to confirm available scripts. The backend development command may be npm run dev; production should use the configured npm start script.
