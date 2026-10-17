import 'dotenv/config'
import http from 'node:http'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import app from './app.js'
import User from './models/User.js'
import Conversation from './models/Conversation.js'
import Message from './models/Message.js'
import { getAuthCookieName } from './utils/authToken.js'
import { isValidObjectId } from './utils/validateObjectId.js'

const httpServer = http.createServer(app)

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})

function readCookie(cookieHeader, cookieName) {
  if (typeof cookieHeader !== 'string') return null

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue

    const name = part.slice(0, separator).trim()
    if (name !== cookieName) continue

    const value = part.slice(separator + 1).trim()

    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

function emitMessageStatus(conversation, message) {
  let targets = io.to(`conversation:${conversation._id}`)

  for (const participantId of conversation.participants) {
    targets = targets.to(`user:${participantId}`)
  }

  targets.emit('message:status', {
    conversationId: String(conversation._id),
    messageId: String(message._id),
    deliveredTo: (message.deliveredTo || []).map(String),
    readBy: (message.readBy || []).map(String),
  })
}

io.use(async (socket, next) => {
  try {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      return next(new Error('Server authentication is not configured.'))
    }

    const token = readCookie(
      socket.handshake.headers.cookie,
      getAuthCookieName(),
    )

    if (!token) {
      return next(new Error('Please log in to continue.'))
    }

    const payload = jwt.verify(token, secret, {
      issuer: 'chatwave',
      audience: 'chatwave-web',
    })

    if (!payload.sub) {
      return next(new Error('Your session is invalid.'))
    }

    const user = await User.findById(payload.sub).select('_id userId')

    if (!user) {
      return next(new Error('Your account could not be found.'))
    }

    socket.data.userId = String(user._id)
    return next()
  } catch {
    return next(
      new Error('Your session is invalid or expired. Please log in again.'),
    )
  }
})

io.on('connection', (socket) => {
  const userId = socket.data.userId

  // Receive messages across chats without polling the API.
  socket.join(`user:${userId}`)

  socket.on('conversation:join', async (payload = {}) => {
    try {
      const conversationId = payload.conversationId

      if (!isValidObjectId(conversationId)) return

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      }).select('_id')

      if (!conversation) return

      for (const room of socket.rooms) {
        if (room.startsWith('conversation:')) {
          socket.leave(room)
        }
      }

      socket.join(`conversation:${conversationId}`)
    } catch (error) {
      console.error('Could not join conversation room:', error.message)
    }
  })

  socket.on('conversation:leave', (payload = {}) => {
    const conversationId = payload.conversationId

    if (isValidObjectId(conversationId)) {
      socket.leave(`conversation:${conversationId}`)
    }
  })

  socket.on('message:delivered', async (payload = {}) => {
    try {
      const { conversationId, messageId } = payload

      if (
        !isValidObjectId(conversationId) ||
        !isValidObjectId(messageId)
      ) {
        return
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      }).select('_id participants')

      if (!conversation) return

      const result = await Message.updateOne(
        {
          _id: messageId,
          conversation: conversationId,
          sender: { $ne: userId },
          deletedAt: null,
          deliveredTo: { $ne: userId },
        },
        {
          $addToSet: { deliveredTo: userId },
        },
      )

      if (!result.modifiedCount) return

      const updated = await Message.findById(messageId).select(
        '_id deliveredTo readBy',
      )

      if (updated) {
        emitMessageStatus(conversation, updated)
      }
    } catch (error) {
      console.error(
        'Could not update message delivery status:',
        error.message,
      )
    }
  })

  socket.on('conversation:seen', async (payload = {}) => {
    try {
      const conversationId = payload.conversationId

      if (!isValidObjectId(conversationId)) return

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      }).select('_id participants userSettings')

      if (!conversation) return

      const userSettings = (conversation.userSettings || []).find(
        (item) => String(item.user) === userId,
      )

      const query = {
        conversation: conversationId,
        sender: { $ne: userId },
        deletedAt: null,
        $or: [
          { readBy: { $ne: userId } },
          { deliveredTo: { $ne: userId } },
        ],
      }

      if (userSettings?.clearedAt) {
        query.createdAt = { $gt: userSettings.clearedAt }
      }

      const incomingMessages = await Message.find(query).select('_id')

      if (!incomingMessages.length) return

      const messageIds = incomingMessages.map((message) => message._id)

      await Message.updateMany(
        { _id: { $in: messageIds } },
        {
          $addToSet: {
            deliveredTo: userId,
            readBy: userId,
          },
        },
      )

      const updatedMessages = await Message.find({
        _id: { $in: messageIds },
      }).select('_id deliveredTo readBy')

      for (const message of updatedMessages) {
        emitMessageStatus(conversation, message)
      }
    } catch (error) {
      console.error('Could not update seen status:', error.message)
    }
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