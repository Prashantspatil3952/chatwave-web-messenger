import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'

import authRoutes from './routes/auth.routes.js'
import conversationRoutes from './routes/conversation.routes.js'
import messageRoutes from './routes/message.routes.js'
import fileRoutes from './routes/file.routes.js'

const app = express()

const allowedOrigins = (
  process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.disable('x-powered-by')
app.use(helmet())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'ChatWave API',
    message: 'Backend is running',
  })
})

app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'ChatWave API',
    health: '/api/health',
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/conversations', conversationRoutes)

app.use(
  '/api/conversations/:conversationId/messages',
  messageRoutes,
)

app.use((_req, res) => {
  res.status(404).json({
    message: 'API endpoint not found.',
  })
})

app.use((error, _req, res, _next) => {
  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      message: 'This origin is not allowed.',
    })
  }

  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json({
      message: 'The uploaded file or request is too large.',
    })
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      message: 'Invalid JSON request body.',
    })
  }

  console.error('API error:', error.message)

  return res.status(500).json({
    message: 'An unexpected server error occurred.',
  })
})

export default app