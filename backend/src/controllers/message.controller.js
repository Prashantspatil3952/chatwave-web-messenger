import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import { isValidObjectId } from '../utils/validateObjectId.js'

const SENDER_FIELDS = 'displayName userId avatarUrl'

async function findParticipantConversation(conversationId, userId) {
  if (!isValidObjectId(conversationId)) {
    return null
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  })
}

export async function listMessages(req, res, next) {
  try {
    const { conversationId } = req.params

    const conversation = await findParticipantConversation(
      conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50

    const query = {
      conversation: conversation._id,
      deletedAt: null,
    }

    if (req.query.before) {
      if (!isValidObjectId(req.query.before)) {
        return res.status(400).json({
          message: 'Invalid message cursor.',
        })
      }

      const cursor = await Message.findOne({
        _id: req.query.before,
        conversation: conversation._id,
      }).select('_id createdAt')

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
    }

    const messages = await Message.find(query)
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
    next(error)
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { conversationId } = req.params
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
      conversationId,
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
      text,
      readBy: [req.user._id],
    })

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: message._id,
          lastMessageText: text.slice(0, 200),
          lastMessageAt: message.createdAt,
        },
      },
    )

    await message.populate('sender', SENDER_FIELDS)

    return res.status(201).json({
      message: 'Message sent.',
      data: message,
    })
  } catch (error) {
    next(error)
  }
}