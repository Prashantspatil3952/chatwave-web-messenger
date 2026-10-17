import mongoose from 'mongoose'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import { isValidObjectId } from '../utils/validateObjectId.js'

const SENDER_FIELDS = 'displayName userId avatarUrl lastSeenAt'

function findSettings(conversation, userId) {
  return (conversation.userSettings || []).find(
    (item) => String(item.user) === String(userId),
  )
}

function messagePreview(message) {
  if (!message) return ''
  if (message.type === 'image') return 'Photo'
  if (message.type === 'audio') return 'Voice message'
  if (message.type === 'file') return message.attachment?.name || 'File'
  return message.text || ''
}

function reopenForParticipants(conversation) {
  for (const participantId of conversation.participants) {
    let settings = findSettings(conversation, participantId)

    if (!settings) {
      conversation.userSettings.push({
        user: participantId,
        hidden: false,
      })
      settings = findSettings(conversation, participantId)
    }

    if (settings) settings.hidden = false
  }
}

function emitConversationEvent(req, conversation, eventName, payload) {
  const io = req.app.get('io')
  if (!io) return

  let targets = io.to(`conversation:${conversation._id}`)

  for (const participantId of conversation.participants) {
    targets = targets.to(`user:${participantId}`)
  }

  targets.emit(eventName, payload)
}

async function findParticipantConversation(conversationId, userId) {
  if (!isValidObjectId(conversationId)) return null

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  })
    .select(
      '_id participants userSettings lastMessage lastMessageText lastMessageAt createdAt',
    )
    .exec()
}

// GET /api/conversations/:conversationId/messages
export async function listMessages(req, res, next) {
  try {
    const conversation = await findParticipantConversation(
      req.params.conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 60)
      : 40

    const settings = findSettings(conversation, req.user._id)
    const query = {
      conversation: conversation._id,
      deletedAt: null,
    }

    if (settings?.clearedAt) {
      query.createdAt = { $gt: settings.clearedAt }
    }

    if (req.query.before) {
      if (!isValidObjectId(req.query.before)) {
        return res.status(400).json({
          message: 'Invalid message cursor.',
        })
      }

      const cursorQuery = {
        _id: req.query.before,
        conversation: conversation._id,
      }

      if (settings?.clearedAt) {
        cursorQuery.createdAt = { $gt: settings.clearedAt }
      }

      const cursor = await Message.findOne(cursorQuery).select(
        '_id createdAt',
      )

      if (!cursor) {
        return res.status(400).json({
          message: 'Message cursor was not found in this conversation.',
        })
      }

      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          _id: { $lt: cursor._id },
        },
      ]

      if (settings?.clearedAt) {
        query.$and = [{ createdAt: { $gt: settings.clearedAt } }]
        delete query.createdAt
      }
    }

    const messages = await Message.find(query)
      .select(
        '_id conversation sender type text attachment deliveredTo readBy editedAt deletedAt createdAt updatedAt',
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate('sender', SENDER_FIELDS)
      .lean()

    messages.reverse()

    return res.status(200).json({
      messages,
      hasMore: messages.length === limit,
    })
  } catch (error) {
    return next(error)
  }
}

// POST /api/conversations/:conversationId/messages
export async function sendMessage(req, res, next) {
  try {
    const rawText = req.body?.text

    if (typeof rawText !== 'string') {
      return res.status(400).json({
        message: 'Message text is required.',
      })
    }

    const text = rawText.trim()

    if (!text) {
      return res.status(400).json({
        message: 'Message text cannot be empty.',
      })
    }

    if (text.length > 4000) {
      return res.status(400).json({
        message: 'Messages cannot exceed 4000 characters.',
      })
    }

    const conversation = await findParticipantConversation(
      req.params.conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      type: 'text',
      text,
      deliveredTo: [],
      readBy: [req.user._id],
    })

    reopenForParticipants(conversation)

    conversation.lastMessage = message._id
    conversation.lastMessageText = messagePreview(message).slice(0, 200)
    conversation.lastMessageAt = message.createdAt

    await conversation.save()
    await message.populate('sender', SENDER_FIELDS)

    const data = message.toObject()

    emitConversationEvent(req, conversation, 'message:new', {
      conversationId: String(conversation._id),
      data,
    })

    return res.status(201).json({
      message: 'Message sent.',
      data,
    })
  } catch (error) {
    return next(error)
  }
}

// PATCH /api/conversations/:conversationId/messages/:messageId
export async function editMessage(req, res, next) {
  try {
    const { conversationId, messageId } = req.params
    const rawText = req.body?.text

    if (typeof rawText !== 'string') {
      return res.status(400).json({
        message: 'Message text is required.',
      })
    }

    const text = rawText.trim()

    if (!text) {
      return res.status(400).json({
        message: 'Message text cannot be empty.',
      })
    }

    if (text.length > 4000) {
      return res.status(400).json({
        message: 'Messages cannot exceed 4000 characters.',
      })
    }

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        message: 'Invalid message ID.',
      })
    }

    const conversation = await findParticipantConversation(
      conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    // Accept legacy text messages that were created before type was added.
    const message = await Message.findOne({
      _id: messageId,
      conversation: conversation._id,
      sender: req.user._id,
      $or: [
        { type: 'text' },
        { type: { $exists: false } },
      ],
      deletedAt: null,
    })

    if (!message) {
      return res.status(404).json({
        message: 'Text message not found or you cannot edit it.',
      })
    }

    message.text = text
    message.editedAt = new Date()

    await message.save()

    if (String(conversation.lastMessage) === String(message._id)) {
      conversation.lastMessageText = text.slice(0, 200)
      await conversation.save()
    }

    await message.populate('sender', SENDER_FIELDS)

    emitConversationEvent(req, conversation, 'message:updated', {
      conversationId: String(conversation._id),
      data: message.toObject(),
    })

    return res.status(200).json({
      message: 'Message updated.',
      data: message,
    })
  } catch (error) {
    return next(error)
  }
}

// DELETE /api/conversations/:conversationId/messages/:messageId
export async function deleteMessage(req, res, next) {
  try {
    const { conversationId, messageId } = req.params

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        message: 'Invalid message ID.',
      })
    }

    const conversation = await findParticipantConversation(
      conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    const message = await Message.findOne({
      _id: messageId,
      conversation: conversation._id,
      sender: req.user._id,
      deletedAt: null,
    })

    if (!message) {
      return res.status(404).json({
        message: 'Message not found or you cannot delete it.',
      })
    }

    message.deletedAt = new Date()
    await message.save()

    // Delete stored bytes after marking the message inaccessible.
    if (message.attachment?.fileId && mongoose.connection.db) {
      try {
        const bucket = new mongoose.mongo.GridFSBucket(
          mongoose.connection.db,
          { bucketName: 'chatwaveFiles' },
        )
        await bucket.delete(message.attachment.fileId)
      } catch (storageError) {
        console.error(
          'Could not remove deleted message attachment:',
          storageError.message,
        )
      }
    }

    if (String(conversation.lastMessage) === String(message._id)) {
      const previousMessage = await Message.findOne({
        conversation: conversation._id,
        deletedAt: null,
      }).sort({ createdAt: -1, _id: -1 })

      conversation.lastMessage = previousMessage?._id || null
      conversation.lastMessageText = messagePreview(previousMessage).slice(
        0,
        200,
      )
      conversation.lastMessageAt =
        previousMessage?.createdAt || conversation.createdAt

      await conversation.save()
    }

    emitConversationEvent(req, conversation, 'message:deleted', {
      conversationId: String(conversation._id),
      messageId: String(message._id),
    })

    return res.status(200).json({
      message: 'Message deleted.',
    })
  } catch (error) {
    return next(error)
  }
}