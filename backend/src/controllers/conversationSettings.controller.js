import Conversation from '../models/Conversation.js'
import { isValidObjectId } from '../utils/validateObjectId.js'

function getOrCreateUserSettings(conversation, userId) {
  let settings = (conversation.userSettings || []).find(
    (item) => String(item.user) === String(userId),
  )

  if (!settings) {
    conversation.userSettings.push({ user: userId })
    settings = conversation.userSettings.find(
      (item) => String(item.user) === String(userId),
    )
  }

  return settings
}

async function findConversation(conversationId, userId) {
  if (!isValidObjectId(conversationId)) return null

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  })
}

// PATCH /api/conversations/:conversationId/close
export async function closeConversation(req, res, next) {
  try {
    const conversation = await findConversation(
      req.params.conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    const settings = getOrCreateUserSettings(conversation, req.user._id)
    settings.hidden = true

    await conversation.save()

    const io = req.app.get('io')

    io?.to(`user:${req.user._id}`).emit('conversation:closed', {
      conversationId: String(conversation._id),
    })

    return res.status(200).json({
      message: 'Conversation closed.',
    })
  } catch (error) {
    return next(error)
  }
}

// PATCH /api/conversations/:conversationId/clear-history
export async function clearConversationHistory(req, res, next) {
  try {
    const conversation = await findConversation(
      req.params.conversationId,
      req.user._id,
    )

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found.',
      })
    }

    const settings = getOrCreateUserSettings(conversation, req.user._id)

    settings.clearedAt = new Date()
    settings.hidden = false

    await conversation.save()

    const io = req.app.get('io')

    io?.to(`user:${req.user._id}`).emit('conversation:cleared', {
      conversationId: String(conversation._id),
      clearedAt: settings.clearedAt,
    })

    return res.status(200).json({
      message: 'History cleared for your account.',
      clearedAt: settings.clearedAt,
    })
  } catch (error) {
    return next(error)
  }
}