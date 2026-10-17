import { Router } from 'express'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  downloadFile,
  uploadAvatar,
  uploadConversationFile,
} from '../controllers/file.controller.js'

const router = Router()

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many uploads. Please try again later.',
  },
})

const avatarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many profile-picture changes. Please try again later.',
  },
})

router.post(
  '/conversations/:conversationId',
  requireAuth,
  uploadLimiter,
  express.raw({
    type: 'application/octet-stream',
    limit: '35mb',
  }),
  uploadConversationFile,
)

router.put(
  '/avatar',
  requireAuth,
  avatarLimiter,
  express.raw({
    type: 'application/octet-stream',
    limit: '5mb',
  }),
  uploadAvatar,
)

router.get('/:fileId', requireAuth, downloadFile)

export default router