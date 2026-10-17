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

const onlineSocketCounts = new Map()
const callSessions = new Map()
const callTimeouts = new Map()
const activeCallByUser = new Map()

io.isUserOnline = (userId) =>
  (onlineSocketCounts.get(String(userId)) || 0) > 0

function readCookie(cookieHeader, cookieName) {
  if (typeof cookieHeader !== 'string') return null

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue

    if (part.slice(0, separator).trim() !== cookieName) continue

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

async function getConversationContacts(userId) {
  const conversations = await Conversation.find({
    participants: userId,
  })
    .select('participants')
    .lean()

  const contacts = new Set()

  for (const conversation of conversations) {
    for (const participantId of conversation.participants || []) {
      const id = String(participantId)

      if (id !== String(userId)) {
        contacts.add(id)
      }
    }
  }

  return contacts
}

async function notifyContactsPresence(
  userId,
  online,
  lastSeenAt = null,
) {
  try {
    const contacts = await getConversationContacts(userId)

    for (const contactId of contacts) {
      io.to(`user:${contactId}`).emit('presence:update', {
        userId: String(userId),
        online,
        lastSeenAt,
      })
    }
  } catch (error) {
    console.error('Could not notify presence:', error.message)
  }
}

async function sendInitialPresence(socket, userId) {
  try {
    const contacts = await getConversationContacts(userId)

    for (const contactId of contacts) {
      const user = await User.findById(contactId)
        .select('lastSeenAt')
        .lean()

      socket.emit('presence:update', {
        userId: contactId,
        online: io.isUserOnline(contactId),
        lastSeenAt: user?.lastSeenAt || null,
      })
    }
  } catch (error) {
    console.error('Could not load initial presence:', error.message)
  }
}

function clearCall(callId) {
  const session = callSessions.get(callId)

  if (!session) return null

  callSessions.delete(callId)

  const timeout = callTimeouts.get(callId)

  if (timeout) {
    clearTimeout(timeout)
  }

  callTimeouts.delete(callId)

  if (activeCallByUser.get(session.callerId) === callId) {
    activeCallByUser.delete(session.callerId)
  }

  if (activeCallByUser.get(session.calleeId) === callId) {
    activeCallByUser.delete(session.calleeId)
  }

  return session
}

function sendCallEnded(callId, fromUserId, reason = 'ended') {
  const session = callSessions.get(callId)

  if (!session) return

  const fromId = String(fromUserId)
  const peerId =
    fromId === session.callerId
      ? session.calleeId
      : session.callerId

  io.to(`user:${peerId}`).emit('call:ended', {
    callId,
    fromUserId: fromId,
    reason,
  })

  clearCall(callId)
}

function relayCallSignal(socket, payload, eventName, fieldName) {
  const callId = payload?.callId

  const session =
    typeof callId === 'string'
      ? callSessions.get(callId)
      : null

  if (!session || !session.accepted) return

  const userId = String(socket.data.userId)
  let peerId = null

  if (
    userId === session.callerId &&
    session.callerSocketId === socket.id
  ) {
    peerId = session.calleeId
  } else if (
    userId === session.calleeId &&
    session.calleeSocketId === socket.id
  ) {
    peerId = session.callerId
  }

  if (!peerId) return

  const signal = payload[fieldName]

  if (!signal || typeof signal !== 'object') return

  if (fieldName === 'offer' || fieldName === 'answer') {
    if (
      !['offer', 'answer'].includes(signal.type) ||
      typeof signal.sdp !== 'string' ||
      signal.sdp.length > 250000
    ) {
      return
    }
  } else if (
    typeof signal.candidate !== 'string' ||
    signal.candidate.length > 8192
  ) {
    return
  }

  io.to(`user:${peerId}`).emit(eventName, {
    callId,
    fromUserId: userId,
    [fieldName]: signal,
  })
}

io.use(async (socket, next) => {
  try {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      return next(
        new Error('Server authentication is not configured.'),
      )
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
      new Error(
        'Your session is invalid or expired. Please log in again.',
      ),
    )
  }
})

io.on('connection', (socket) => {
  const userId = String(socket.data.userId)
  const currentCount = onlineSocketCounts.get(userId) || 0

  onlineSocketCounts.set(userId, currentCount + 1)
  socket.join(`user:${userId}`)

  if (currentCount === 0) {
    void notifyContactsPresence(userId, true)
  }

  void sendInitialPresence(socket, userId)

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

      const updated = await Message.updateOne(
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

      if (!updated.modifiedCount) return

      const message = await Message.findById(messageId).select(
        '_id deliveredTo readBy',
      )

      if (message) {
        emitMessageStatus(conversation, message)
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

      const settings = (conversation.userSettings || []).find(
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

      if (settings?.clearedAt) {
        query.createdAt = { $gt: settings.clearedAt }
      }

      const incoming = await Message.find(query).select('_id')

      if (!incoming.length) return

      const ids = incoming.map((message) => message._id)

      await Message.updateMany(
        { _id: { $in: ids } },
        {
          $addToSet: {
            deliveredTo: userId,
            readBy: userId,
          },
        },
      )

      const updatedMessages = await Message.find({
        _id: { $in: ids },
      }).select('_id deliveredTo readBy')

      for (const message of updatedMessages) {
        emitMessageStatus(conversation, message)
      }

      for (const participantId of conversation.participants) {
        if (String(participantId) !== userId) {
          io.to(`user:${participantId}`).emit('conversation:read', {
            conversationId: String(conversationId),
            readByUserId: userId,
          })
        }
      }
    } catch (error) {
      console.error('Could not update seen status:', error.message)
    }
  })

  socket.on('call:invite', async (payload = {}) => {
    try {
      const conversationId = payload.conversationId
      const callId =
        typeof payload.callId === 'string'
          ? payload.callId
          : ''
      const mode = payload.mode === 'video' ? 'video' : 'audio'

      if (
        !isValidObjectId(conversationId) ||
        !/^[\w-]{8,100}$/.test(callId)
      ) {
        socket.emit('call:error', {
          callId,
          message: 'Invalid call request.',
        })
        return
      }

      if (activeCallByUser.has(userId)) {
        socket.emit('call:busy', {
          callId,
          message: 'You are already in a call.',
        })
        return
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
        isGroup: false,
      }).select('_id participants')

      if (!conversation) {
        socket.emit('call:error', {
          callId,
          message: 'Calls are available only in direct conversations.',
        })
        return
      }

      const calleeId = conversation.participants
        .map(String)
        .find((id) => id !== userId)

      if (!calleeId || !io.isUserOnline(calleeId)) {
        socket.emit('call:unavailable', {
          callId,
          message: 'This user is currently offline.',
        })
        return
      }

      if (activeCallByUser.has(calleeId)) {
        socket.emit('call:busy', {
          callId,
          message: 'This user is already in a call.',
        })
        return
      }

      if (callSessions.has(callId)) {
        socket.emit('call:error', {
          callId,
          message: 'Call identifier already exists.',
        })
        return
      }

      const caller = await User.findById(userId).select(
        'displayName userId avatarUrl',
      )

      const session = {
        callId,
        conversationId: String(conversation._id),
        callerId: userId,
        calleeId,
        callerSocketId: socket.id,
        calleeSocketId: null,
        mode,
        createdAt: Date.now(),
        accepted: false,
      }

      callSessions.set(callId, session)
      activeCallByUser.set(userId, callId)
      activeCallByUser.set(calleeId, callId)

      const timeout = setTimeout(() => {
        const pending = callSessions.get(callId)

        if (!pending || pending.accepted) return

        io.to(`user:${pending.callerId}`).emit('call:ended', {
          callId,
          reason: 'unanswered',
        })

        io.to(`user:${pending.calleeId}`).emit('call:ended', {
          callId,
          reason: 'missed',
        })

        clearCall(callId)
      }, 45000)

      callTimeouts.set(callId, timeout)

      socket.emit('call:ringing', { callId, mode })

      io.to(`user:${calleeId}`).emit('call:incoming', {
        callId,
        conversationId: session.conversationId,
        mode,
        caller: caller
          ? {
              id: String(caller._id),
              displayName: caller.displayName,
              userId: caller.userId,
              avatarUrl: caller.avatarUrl,
            }
          : {
              id: userId,
              displayName: 'ChatWave user',
              userId: '',
            },
      })
    } catch (error) {
      console.error('Could not start call:', error.message)

      socket.emit('call:error', {
        callId: payload.callId,
        message: 'Could not start this call.',
      })
    }
  })

  socket.on('call:accept', (payload = {}) => {
    const session = callSessions.get(payload.callId)

    if (
      !session ||
      session.calleeId !== userId ||
      session.accepted
    ) {
      return
    }

    session.calleeSocketId = socket.id
    session.accepted = true

    const timeout = callTimeouts.get(session.callId)

    if (timeout) {
      clearTimeout(timeout)
    }

    callTimeouts.delete(session.callId)

    io.to(`user:${session.callerId}`).emit('call:accepted', {
      callId: session.callId,
      mode: session.mode,
    })

    // Corrected template literal: the closing brace is required here.
    io.to(`user:${session.calleeId}`)
      .except(socket.id)
      .emit('call:answered-elsewhere', {
        callId: session.callId,
      })
  })

  socket.on('call:reject', (payload = {}) => {
    const session = callSessions.get(payload.callId)

    if (
      !session ||
      ![session.callerId, session.calleeId].includes(userId)
    ) {
      return
    }

    const peerId =
      userId === session.callerId
        ? session.calleeId
        : session.callerId

    io.to(`user:${peerId}`).emit('call:rejected', {
      callId: session.callId,
      reason:
        typeof payload.reason === 'string'
          ? payload.reason.slice(0, 80)
          : 'rejected',
    })

    clearCall(session.callId)
  })

  socket.on('call:offer', (payload = {}) => {
    relayCallSignal(socket, payload, 'call:offer', 'offer')
  })

  socket.on('call:answer', (payload = {}) => {
    relayCallSignal(socket, payload, 'call:answer', 'answer')
  })

  socket.on('call:ice-candidate', (payload = {}) => {
    relayCallSignal(
      socket,
      payload,
      'call:ice-candidate',
      'candidate',
    )
  })

  socket.on('call:end', (payload = {}) => {
    const callId = payload.callId
    const session =
      typeof callId === 'string'
        ? callSessions.get(callId)
        : null

    if (
      !session ||
      ![session.callerId, session.calleeId].includes(userId)
    ) {
      return
    }

    sendCallEnded(callId, userId, 'ended')
  })

  socket.on('disconnect', async () => {
    const activeCallId = activeCallByUser.get(userId)
    const session = activeCallId
      ? callSessions.get(activeCallId)
      : null

    if (
      session &&
      (
        session.callerSocketId === socket.id ||
        session.calleeSocketId === socket.id
      )
    ) {
      sendCallEnded(activeCallId, userId, 'connection-lost')
    }

    const remaining = Math.max(
      0,
      (onlineSocketCounts.get(userId) || 1) - 1,
    )

    if (remaining > 0) {
      onlineSocketCounts.set(userId, remaining)
      return
    }

    onlineSocketCounts.delete(userId)

    const lastSeenAt = new Date()

    try {
      await User.updateOne(
        { _id: userId },
        { $set: { lastSeenAt } },
      )
    } catch (error) {
      console.error('Could not update last-seen time:', error.message)
    }

    void notifyContactsPresence(userId, false, lastSeenAt)
  })
})

app.set('io', io)

const port = Number(process.env.PORT) || 5000

async function repairObsoleteConversationIndexes() {
  const indexes = await Conversation.collection.indexes()

  for (const index of indexes) {
    const fields = Object.keys(index.key || {})
    const obsolete =
      fields.length === 1 && fields[0] === 'participants'

    if (index.name !== '_id_' && index.unique && obsolete) {
      console.warn(
        `Removing obsolete unique conversation index: ${index.name}`,
      )

      await Conversation.collection.dropIndex(index.name)
    }
  }

  await Conversation.createIndexes()
}

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from backend/.env')
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from backend/.env')
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
    })

    console.log('MongoDB connected')

    await Conversation.init()
    await repairObsoleteConversationIndexes()
    await Message.init()

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