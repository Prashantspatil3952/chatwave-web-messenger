import Conversation from '../models/Conversation.js'
import User from '../models/User.js'
import { normalizeUserId } from '../utils/validators.js'

const PARTICIPANT_FIELDS = 'displayName userId avatarUrl lastSeenAt'

function getUserSettings(conversation, userId) {
  return (conversation.userSettings || []).find(
    (item) => String(item.user) === String(userId),
  )
}

function publicConversation(conversation) {
  const result =
    typeof conversation.toObject === 'function'
      ? conversation.toObject()
      : { ...conversation }

  delete result.userSettings
  return result
}

// GET /api/conversations
export async function listConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      $nor: [
        {
          userSettings: {
            $elemMatch: { user: req.user._id, hidden: true },
          },
        },
      ],
    })
      .select(
        '_id participants isGroup title createdBy lastMessage lastMessageText lastMessageAt createdAt updatedAt userSettings',
      )
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(60)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate({
        path: 'lastMessage',
        select: 'text sender createdAt',
      })
      .lean()

    const visibleConversations = conversations.map((conversation) => {
      const settings = getUserSettings(conversation, req.user._id)
      const clearedAt = settings?.clearedAt
        ? new Date(settings.clearedAt)
        : null
      const latestMessageAt = conversation.lastMessageAt
        ? new Date(conversation.lastMessageAt)
        : null

      // Hide previews that belong to history this user cleared.
      if (clearedAt && latestMessageAt && latestMessageAt <= clearedAt) {
        conversation.lastMessage = null
        conversation.lastMessageText = ''
        conversation.lastMessageAt = null
      }

      delete conversation.userSettings
      return conversation
    })

    return res.status(200).json({
      conversations: visibleConversations,
    })
  } catch (error) {
    return next(error)
  }
}

// POST /api/conversations
export async function createConversation(req, res, next) {
  try {
    const userId = normalizeUserId(req.body?.userId)

    if (!userId) {
      return res.status(400).json({
        message:
          'Enter a valid user ID containing 4–30 letters, numbers, or underscores.',
      })
    }

    const otherUser = await User.findOne({ userId }).select(
      '_id displayName userId',
    )

    if (!otherUser) {
      return res.status(404).json({
        message: 'No user was found with that user ID.',
      })
    }

    if (otherUser._id.equals(req.user._id)) {
      return res.status(400).json({
        message: 'You cannot start a conversation with yourself.',
      })
    }

    const participants = [req.user._id, otherUser._id]

    // Reuse a direct conversation if one already exists.
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: participants },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    })

    let created = false

    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        isGroup: false,
        createdBy: req.user._id,
        userSettings: participants.map((participant) => ({
          user: participant,
        })),
      })

      created = true
    }

    let ownSettings = getUserSettings(conversation, req.user._id)

    if (!ownSettings) {
      conversation.userSettings.push({
        user: req.user._id,
        hidden: false,
      })
      ownSettings = getUserSettings(conversation, req.user._id)
    }

    if (ownSettings) {
      ownSettings.hidden = false
    }

    await conversation.save()

    await conversation.populate('participants', PARTICIPANT_FIELDS)
    await conversation.populate({
      path: 'lastMessage',
      select: 'text sender createdAt',
    })

    return res.status(created ? 201 : 200).json({
      message: created
        ? 'Conversation created.'
        : 'Conversation already exists.',
      conversation: publicConversation(conversation),
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A conversation could not be created due to a duplicate.',
      })
    }

    return next(error)
  }
}