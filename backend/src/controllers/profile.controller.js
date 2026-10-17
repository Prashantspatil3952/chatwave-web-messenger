import User from '../models/User.js'
import Conversation from '../models/Conversation.js'
import { validateDisplayName } from '../utils/validators.js'

function publicUser(user) {
  return {
    id: String(user._id),
    userId: user.userId,
    displayName: user.displayName,
    isEmailVerified: user.isEmailVerified,
    avatarUrl: user.avatarUrl
      ? /^https?:\/\//i.test(user.avatarUrl)
        ? user.avatarUrl
        : `/api/files/${String(user.avatarUrl).replace(/^\/api\/files\//, '')}`
      : '',
    lastSeenAt: user.lastSeenAt || null,
  }
}

export async function updateProfile(req, res, next) {
  try {
    const displayName =
      typeof req.body?.displayName === 'string'
        ? req.body.displayName.trim()
        : ''

    if (!validateDisplayName(displayName)) {
      return res.status(400).json({
        message: 'Display name must contain 2–50 characters.',
      })
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { displayName } },
      { new: true, runValidators: true },
    ).select(
      '_id userId displayName email isEmailVerified avatarUrl lastSeenAt',
    )

    if (!user) {
      return res.status(404).json({
        message: 'Your account could not be found.',
      })
    }

    const io = req.app.get('io')
    const event = { user: publicUser(user) }

    try {
      io?.to(`user:${user._id}`).emit('profile:updated', event)

      if (io) {
        const conversations = await Conversation.find({
          participants: user._id,
        })
          .select('participants')
          .lean()

        const contacts = new Set()

        for (const conversation of conversations) {
          for (const participantId of conversation.participants || []) {
            const id = String(participantId)
            if (id !== String(user._id)) contacts.add(id)
          }
        }

        for (const contactId of contacts) {
          io.to(`user:${contactId}`).emit('profile:updated', event)
        }
      }
    } catch (broadcastError) {
      console.error(
        'Profile saved, but live update failed:',
        broadcastError.message,
      )
    }

    return res.status(200).json({
      message: 'Profile updated.',
      user: publicUser(user),
    })
  } catch (error) {
    return next(error)
  }
}