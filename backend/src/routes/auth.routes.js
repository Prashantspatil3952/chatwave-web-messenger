import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  requestRegistrationOtp,
  register,
  login,
  logout,
  getCurrentUser,
  requestPasswordResetOtp,
  resetPassword,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { updateProfile } from '../controllers/profile.controller.js'

const router = Router()

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many code requests. Please try again later.',
  },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again later.',
  },
})

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many password-reset attempts. Please try again later.',
  },
})

router.post(
  '/register/request-otp',
  otpRequestLimiter,
  requestRegistrationOtp,
)

router.post('/register', register)
router.post('/login', loginLimiter, login)
router.post('/logout', logout)

router.get('/me', requireAuth, getCurrentUser)
router.patch('/profile', requireAuth, updateProfile)

router.post(
  '/forgot-password/request-otp',
  otpRequestLimiter,
  requestPasswordResetOtp,
)

router.post(
  '/forgot-password/reset',
  resetLimiter,
  resetPassword,
)

export default router