import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { normalizeEmail, normalizeUserId } from '../utils/validators.js'

const PARTICIPANT_FIELDS =
  'displayName userId avatarUrl lastSeenAt'

function getUserSettings(conversation, userId) {
  return (conversation.userSettings || []).find(
    (item) => String(item.user) === String(userId),
  )
}

// Version the key to avoid colliding with old, potentially stale keys.
function directKeyFor(participants) {
  return `v2:${participants.map(String).sort().join(':')}`
}

function publicConversation(conversation) {
  const result =
    typeof conversation.toObject === 'function'
      ? conversation.toObject()
      : { ...conversation }

  delete result.userSettings
  return result
}

function attachPresence(conversations, io) {
  for (const conversation of conversations) {
    for (const participant of conversation.participants || []) {
      const id = String(participant?._id || '')
      participant.isOnline = Boolean(io?.isUserOnline?.(id))
    }
  }
}

// Find a direct conversation by its actual participants.
// This also finds legacy conversations without a directKey,
// and conversations where isGroup was not explicitly stored.
async function findDirectConversation(participants) {
  return Conversation.findOne({
    isGroup: { $ne: true },
    participants: { $all: participants },
    $expr: {
      $eq: [{ $size: '$participants' }, 2],
    },
  }).sort({ createdAt: 1 })
}

async function prepareConversationForResponse(conversation, userId) {
  if (!Array.isArray(conversation.userSettings)) {
    conversation.userSettings = []
  }

  let settings = getUserSettings(conversation, userId)

  if (!settings) {
    conversation.userSettings.push({
      user: userId,
      hidden: false,
    })
    settings = getUserSettings(conversation, userId)
  }

  settings.hidden = false

  await conversation.save()

  await conversation.populate('participants', PARTICIPANT_FIELDS)
  await conversation.populate({
    path: 'lastMessage',
    select: '_id text type attachment createdAt',
  })

  return conversation
}

async function findOtherUser(identity) {
  if (identity.includes('@')) {
    const email = normalizeEmail(identity)

    if (!email) return null

    return User.findOne({ email }).select(
      '_id displayName userId email avatarUrl lastSeenAt',
    )
  }

  const userId = normalizeUserId(identity)

  if (!userId) return null

  // User.js defines userId, not username.
  return User.findOne({ userId }).select(
    '_id displayName userId email avatarUrl lastSeenAt',
  )
}

// GET /api/conversations
export async function listConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      $nor: [
        {
          userSettings: {
            $elemMatch: {
              user: req.user._id,
              hidden: true,
            },
          },
        },
      ],
    })
      .select(
        '_id participants isGroup title createdBy directKey lastMessage lastMessageText lastMessageAt createdAt updatedAt userSettings',
      )
      .sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 })
      .limit(60)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate({
        path: 'lastMessage',
        select: '_id text type attachment createdAt',
      })
      .lean()

    const unreadClauses = conversations.map((conversation) => {
      const settings = getUserSettings(conversation, req.user._id)
      const clause = { conversation: conversation._id }

      if (settings?.clearedAt) {
        clause.createdAt = {
          $gt: new Date(settings.clearedAt),
        }
      }

      return clause
    })

    const unreadRows = unreadClauses.length
      ? await Message.aggregate([
          {
            $match: {
              $or: unreadClauses,
              sender: { $ne: req.user._id },
              deletedAt: null,
              readBy: { $ne: req.user._id },
            },
          },
          {
            $group: {
              _id: '$conversation',
              count: { $sum: 1 },
            },
          },
        ])
      : []

    const unreadCounts = new Map(
      unreadRows.map((row) => [String(row._id), row.count]),
    )

    const visibleConversations = conversations.map((conversation) => {
      const settings = getUserSettings(conversation, req.user._id)

      const clearedAt = settings?.clearedAt
        ? new Date(settings.clearedAt)
        : null

      const latestMessageAt = conversation.lastMessageAt
        ? new Date(conversation.lastMessageAt)
        : null

      if (
        clearedAt &&
        latestMessageAt &&
        latestMessageAt <= clearedAt
      ) {
        conversation.lastMessage = null
        conversation.lastMessageText = ''
        conversation.lastMessageAt = null
      }

      conversation.unreadCount =
        unreadCounts.get(String(conversation._id)) || 0

      delete conversation.userSettings
      return conversation
    })

    attachPresence(visibleConversations, req.app.get('io'))

    return res.status(200).json({
      conversations: visibleConversations,
    })
  } catch (error) {
    return next(error)
  }
}

// POST /api/conversations
// Accepts { identity }, { userId }, or { email }.
export async function createConversation(req, res, next) {
  let identity = ''

  try {
    identity =
      [
        req.body?.identity,
        req.body?.userId,
        req.body?.email,
      ]
        .find(
          (value) =>
            typeof value === 'string' && value.trim(),
        )
        ?.trim() || ''

    if (!identity) {
      return res.status(400).json({
        message:
          'Enter the other person’s unique ChatWave user ID or registered email.',
      })
    }

    const isEmail = identity.includes('@')

    if (isEmail) {
      if (!normalizeEmail(identity)) {
        return res.status(400).json({
          message: 'Enter a valid email address.',
        })
      }
    } else {
      if (!normalizeUserId(identity)) {
        return res.status(400).json({
          message:
            'Enter a valid ChatWave user ID using 4–30 letters, numbers, or underscores.',
        })
      }
    }

    const otherUser = await findOtherUser(identity)

    if (!otherUser) {
      return res.status(404).json({
        message: isEmail
          ? 'No ChatWave account was found with that email address.'
          : 'No ChatWave account was found with that user ID.',
      })
    }

    if (String(otherUser._id) === String(req.user._id)) {
      return res.status(400).json({
        message: 'You cannot start a conversation with yourself.',
      })
    }

    const participants = [req.user._id, otherUser._id]

    // Always look up the participant pair before creating anything.
    let conversation = await findDirectConversation(participants)
    let created = false

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          participants,
          isGroup: false,
          directKey: directKeyFor(participants),
          createdBy: req.user._id,
          userSettings: participants.map((participant) => ({
            user: participant,
            hidden: false,
          })),
        })

        created = true
      } catch (createError) {
        if (createError.code !== 11000) {
          throw createError
        }

        // A parallel request may have created the conversation.
        conversation = await findDirectConversation(participants)

        if (!conversation) {
          throw createError
        }
      }
    }

    // Do not change directKey on older conversations.
    conversation = await prepareConversationForResponse(
      conversation,
      req.user._id,
    )

    return res.status(created ? 201 : 200).json({
      message: created
        ? 'Conversation created.'
        : 'Existing conversation opened.',
      conversation: publicConversation(conversation),
    })
  } catch (error) {
    if (error.code === 11000 && identity) {
      try {
        const otherUser = await findOtherUser(identity)

        if (
          otherUser &&
          String(otherUser._id) !== String(req.user._id)
        ) {
          const participants = [req.user._id, otherUser._id]
          const existing = await findDirectConversation(participants)

          if (existing) {
            const prepared = await prepareConversationForResponse(
              existing,
              req.user._id,
            )

            return res.status(200).json({
              message: 'Existing conversation opened.',
              conversation: publicConversation(prepared),
            })
          }
        }
      } catch (recoveryError) {
        return next(recoveryError)
      }

      console.error(
        'Could not recover duplicate conversation key:',
        error.keyValue || error.message,
      )

      return res.status(409).json({
        message:
          'A database conflict prevented the conversation from opening. Please retry.',
      })
    }

    return next(error)
  }
}