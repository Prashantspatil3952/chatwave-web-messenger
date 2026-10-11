import 'dotenv/config'
import http from 'node:http'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import app from './app.js'

const httpServer = http.createServer(app)

const allowedOrigins = (
  process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id)

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })
})

app.set('io', io)

const port = Number(process.env.PORT) || 5000

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from backend/.env')
    }

    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB connected')

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`ChatWave API running on port ${port}`)
    })
  } catch (error) {
    console.error('Failed to start ChatWave:', error.message)
    process.exit(1)
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down ChatWave...`)

  httpServer.close()

  try {
    await mongoose.disconnect()
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error.message)
  }

  process.exit(0)
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

startServer()