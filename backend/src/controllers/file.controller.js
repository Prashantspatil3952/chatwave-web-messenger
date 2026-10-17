import path from 'node:path'
import mongoose from 'mongoose'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { isValidObjectId } from '../utils/validateObjectId.js'

const MAX_FILE_BYTES = 35 * 1024 * 1024
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const SENDER_FIELDS = 'displayName userId avatarUrl lastSeenAt'

const TYPES = {
  '.jpg': { mime: 'image/jpeg', kind: 'image' },
  '.jpeg': { mime: 'image/jpeg', kind: 'image' },
  '.png': { mime: 'image/png', kind: 'image' },
  '.gif': { mime: 'image/gif', kind: 'image' },
  '.webp': { mime: 'image/webp', kind: 'image' },
  '.avif': { mime: 'image/avif', kind: 'image' },
  '.pdf': { mime: 'application/pdf', kind: 'file' },
  '.txt': { mime: 'text/plain; charset=utf-8', kind: 'file' },
  '.csv': { mime: 'text/csv; charset=utf-8', kind: 'file' },
  '.doc': { mime: 'application/msword', kind: 'file' },
  '.docx': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'file',
  },
  '.xls': { mime: 'application/vnd.ms-excel', kind: 'file' },
  '.xlsx': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    kind: 'file',
  },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', kind: 'file' },
  '.pptx': {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    kind: 'file',
  },
  '.webm': { mime: 'audio/webm', kind: 'audio' },
  '.ogg': { mime: 'audio/ogg', kind: 'audio' },
  '.mp3': { mime: 'audio/mpeg', kind: 'audio' },
  '.wav': { mime: 'audio/wav', kind: 'audio' },
  '.m4a': { mime: 'audio/mp4', kind: 'audio' },
}

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error(
      'File storage is not available because the database is disconnected.',
    )
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'chatwaveFiles',
  })
}

function safeFileName(rawName) {
  let name = typeof rawName === 'string' ? rawName : ''

  try {
    name = decodeURIComponent(name)
  } catch {
    // Keep the original header if URL decoding fails.
  }

  name = path
    .basename(name.replaceAll('\\', '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()

  if (!name || name === '.' || name === '..') return null
  return name.slice(0, 180)
}

function detectType(buffer, extension) {
  const info = TYPES[extension]
  if (!info) return null

  const starts = (...bytes) =>
    bytes.every((value, index) => buffer[index] === value)
  const ascii = (start, end) => buffer.subarray(start, end).toString('ascii')
  const isZip = starts(0x50, 0x4b, 0x03, 0x04)
  const isOle = starts(
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
  )

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return starts(0xff, 0xd8, 0xff) ? info : null
    case '.png':
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        ? info
        : null
    case '.gif':
      return ['GIF87a', 'GIF89a'].includes(ascii(0, 6)) ? info : null
    case '.webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
        ? info
        : null
    case '.avif':
      return (
        ascii(4, 8) === 'ftyp' &&
        /avif|avis/.test(ascii(8, Math.min(buffer.length, 32)))
      )
        ? info
        : null
    case '.pdf':
      return ascii(0, 5) === '%PDF-' ? info : null
    case '.doc':
    case '.xls':
    case '.ppt':
      return isOle ? info : null
    case '.docx':
      return isZip && buffer.includes(Buffer.from('word/document.xml'))
        ? info
        : null
    case '.xlsx':
      return isZip && buffer.includes(Buffer.from('xl/')) ? info : null
    case '.pptx':
      return isZip && buffer.includes(Buffer.from('ppt/')) ? info : null
    case '.txt':
    case '.csv':
      if (buffer.includes(0)) return null
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer)
        return info
      } catch {
        return null
      }
    case '.webm':
      return starts(0x1a, 0x45, 0xdf, 0xa3) ? info : null
    case '.ogg':
      return ascii(0, 4) === 'OggS' ? info : null
    case '.mp3':
      return (
        ascii(0, 3) === 'ID3' ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      )
        ? info
        : null
    case '.wav':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE'
        ? info
        : null
    case '.m4a':
      return ascii(4, 8) === 'ftyp' ? info : null
    default:
      return null
  }
}

function getUpload(req, maxBytes) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return { error: 'Select a non-empty file to upload.' }
  }

  if (req.body.length > maxBytes) {
    return {
      error: `File is too large. The limit is ${Math.floor(maxBytes / 1024 / 1024)} MB.`,
    }
  }

  const name = safeFileName(req.get('x-file-name'))
  if (!name) return { error: 'A valid file name is required.' }

  const extension = path.extname(name).toLowerCase()
  const detected = detectType(req.body, extension)

  if (!detected) {
    return {
      error:
        'This file format is not supported or its contents do not match its extension.',
    }
  }

  return {
    name,
    extension,
    type: detected,
    buffer: req.body,
  }
}

function uploadBuffer(bucket, name, buffer, metadata) {
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(name, { metadata })
    stream.once('error', reject)
    stream.once('finish', () => resolve(stream.id))
    stream.end(buffer)
  })
}

async function deleteGridFile(bucket, fileId) {
  try {
    await bucket.delete(fileId)
    return true
  } catch {
    return false
  }
}

function messagePreview(message) {
  if (message.type === 'image') return 'Photo'
  if (message.type === 'audio') return 'Voice message'
  if (message.type === 'file') return message.attachment?.name || 'File'
  return message.text || ''
}

function emitNewMessage(req, conversation, message) {
  const io = req.app.get('io')
  if (!io) return

  let targets = io.to(`conversation:${conversation._id}`)

  for (const participantId of conversation.participants) {
    targets = targets.to(`user:${participantId}`)
  }

  targets.emit('message:new', {
    conversationId: String(conversation._id),
    data: message,
  })
}

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

// POST /api/files/conversations/:conversationId
export async function uploadConversationFile(req, res, next) {
  let fileId = null
  let messageId = null
  let conversationCommitted = false

  try {
    const upload = getUpload(req, MAX_FILE_BYTES)
    if (upload.error) {
      return res.status(400).json({ message: upload.error })
    }

    if (!isValidObjectId(req.params.conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID.' })
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user._id,
    }).select('_id participants userSettings createdAt')

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' })
    }

    const bucket = getBucket()

    fileId = await uploadBuffer(bucket, upload.name, upload.buffer, {
      purpose: 'attachment',
      uploaderId: String(req.user._id),
      conversationId: String(conversation._id),
      originalName: upload.name,
      mimeType: upload.type.mime,
      size: upload.buffer.length,
    })

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      type: upload.type.kind,
      text: '',
      attachment: {
        fileId,
        name: upload.name,
        mimeType: upload.type.mime,
        size: upload.buffer.length,
      },
      deliveredTo: [],
      readBy: [req.user._id],
    })

    messageId = message._id

    for (const participantId of conversation.participants) {
      let setting = conversation.userSettings.find(
        (item) => String(item.user) === String(participantId),
      )

      if (!setting) {
        conversation.userSettings.push({
          user: participantId,
          hidden: false,
        })
        setting = conversation.userSettings.find(
          (item) => String(item.user) === String(participantId),
        )
      }

      if (setting) setting.hidden = false
    }

    conversation.lastMessage = message._id
    conversation.lastMessageText = messagePreview(message).slice(0, 200)
    conversation.lastMessageAt = message.createdAt

    await conversation.save()
    conversationCommitted = true

    await message.populate('sender', SENDER_FIELDS)

    const data = message.toObject()
    emitNewMessage(req, conversation, data)

    return res.status(201).json({
      message: 'File sent.',
      data,
    })
  } catch (error) {
    if (!conversationCommitted && messageId) {
      try {
        await Message.deleteOne({ _id: messageId })
      } catch {
        // Preserve the original request error.
      }
    }

    if (!conversationCommitted && fileId) {
      try {
        await deleteGridFile(getBucket(), fileId)
      } catch {
        // Preserve the original request error.
      }
    }

    return next(error)
  }
}

// PUT /api/files/avatar
export async function uploadAvatar(req, res, next) {
  let fileId = null

  try {
    const upload = getUpload(req, MAX_AVATAR_BYTES)
    if (upload.error) {
      return res.status(400).json({ message: upload.error })
    }

    if (upload.type.kind !== 'image') {
      return res.status(400).json({
        message: 'Profile pictures must be an image.',
      })
    }

    const bucket = getBucket()

    fileId = await uploadBuffer(bucket, upload.name, upload.buffer, {
      purpose: 'avatar',
      uploaderId: String(req.user._id),
      originalName: upload.name,
      mimeType: upload.type.mime,
      size: upload.buffer.length,
    })

    const previousUser = await User.findById(req.user._id).select('avatarUrl')

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatarUrl: String(fileId) } },
      { new: true, runValidators: true },
    ).select(
      '_id userId displayName email isEmailVerified avatarUrl lastSeenAt',
    )

    if (!user) {
      await deleteGridFile(bucket, fileId)
      return res.status(404).json({
        message: 'Your account could not be found.',
      })
    }

    const oldAvatar = String(previousUser?.avatarUrl || '').replace(
      /^\/api\/files\//,
      '',
    )

    if (isValidObjectId(oldAvatar) && oldAvatar !== String(fileId)) {
      await deleteGridFile(
        bucket,
        new mongoose.Types.ObjectId(oldAvatar),
      )
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
        'Profile picture saved, but live update failed:',
        broadcastError.message,
      )
    }

    return res.status(201).json({
      message: 'Profile picture updated.',
      user: publicUser(user),
    })
  } catch (error) {
    if (fileId) {
      try {
        await deleteGridFile(getBucket(), fileId)
      } catch {
        // Preserve the original request error.
      }
    }

    return next(error)
  }
}

// GET /api/files/:fileId
export async function downloadFile(req, res, next) {
  try {
    if (!isValidObjectId(req.params.fileId)) {
      return res.status(404).json({ message: 'File not found.' })
    }

    const fileId = new mongoose.Types.ObjectId(req.params.fileId)
    const bucket = getBucket()
    const file = await bucket.find({ _id: fileId }).limit(1).next()

    if (!file) {
      return res.status(404).json({ message: 'File not found.' })
    }

    const metadata = file.metadata || {}

    if (metadata.purpose === 'attachment') {
      if (!isValidObjectId(metadata.conversationId)) {
        return res.status(404).json({ message: 'File not found.' })
      }

      const participant = await Conversation.exists({
        _id: metadata.conversationId,
        participants: req.user._id,
      })

      if (!participant) {
        return res.status(404).json({ message: 'File not found.' })
      }

      const activeMessage = await Message.exists({
        conversation: metadata.conversationId,
        'attachment.fileId': fileId,
        deletedAt: null,
      })

      if (!activeMessage) {
        return res.status(404).json({ message: 'File not found.' })
      }
    } else if (metadata.purpose === 'avatar') {
      if (!String(metadata.mimeType || '').startsWith('image/')) {
        return res.status(404).json({ message: 'File not found.' })
      }
    } else {
      return res.status(404).json({ message: 'File not found.' })
    }

    const originalName =
      safeFileName(metadata.originalName || file.filename) || 'download'
    const inline =
      String(metadata.mimeType || '').startsWith('image/') ||
      String(metadata.mimeType || '').startsWith('audio/') ||
      metadata.mimeType === 'application/pdf'
    const fallbackName =
      originalName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download'

    res.setHeader(
      'Content-Type',
      metadata.mimeType || file.contentType || 'application/octet-stream',
    )
    res.setHeader('Content-Length', file.length)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    )

    const stream = bucket.openDownloadStream(fileId)

    stream.once('error', (error) => {
      if (res.headersSent) res.destroy(error)
      else next(error)
    })

    stream.pipe(res)
  } catch (error) {
    return next(error)
  }
}