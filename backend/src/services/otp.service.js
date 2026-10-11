import Otp from '../models/Otp.js'
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
} from '../utils/security.js'
import { sendOtpEmail } from './email.service.js'

const OTP_EXPIRY_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const DAILY_SEND_LIMIT = 10
const MAX_VERIFY_ATTEMPTS = 5
const DAY_MS = 24 * 60 * 60 * 1000

const VALID_PURPOSES = ['registration', 'password-reset']

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw new Error('A valid email address is required.')
  }

  const normalized = email.trim().toLowerCase()

  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error('A valid email address is required.')
  }

  return normalized
}

function validatePurpose(purpose) {
  if (!VALID_PURPOSES.includes(purpose)) {
    throw new Error('Invalid verification purpose.')
  }
}

export async function requestOtp(email, purpose = 'registration') {
  const normalizedEmail = normalizeEmail(email)
  validatePurpose(purpose)

  const now = new Date()
  const dayAgo = new Date(now.getTime() - DAY_MS)

  // Count OTP requests for this email across both purposes.
  // The counter is persisted in MongoDB, not held only in memory.
  const dailyCount = await Otp.countDocuments({
    email: normalizedEmail,
    createdAt: { $gte: dayAgo },
  })

  if (dailyCount >= DAILY_SEND_LIMIT) {
    throw new Error(
      'You have reached the 10 verification-code requests allowed in 24 hours. Please try again later.',
    )
  }

  const latestOtp = await Otp.findOne({
    email: normalizedEmail,
    purpose,
  }).sort({ createdAt: -1 })

  if (
    latestOtp &&
    now.getTime() - latestOtp.createdAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    const remainingSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS -
        (now.getTime() - latestOtp.createdAt.getTime())) /
        1000,
    )

    throw new Error(
      `Please wait ${remainingSeconds} seconds before requesting another code.`,
    )
  }

  const otp = generateOtp()

  // Store only an HMAC hash of the OTP, never the plain code.
  const record = await Otp.create({
    email: normalizedEmail,
    purpose,
    otpHash: hashOtp(otp),
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
  })

  // Keep the request record if Brevo fails. This prevents repeated
  // failed email requests from bypassing the persisted request limit.
  await sendOtpEmail(normalizedEmail, otp, purpose)

  return {
    message: 'Verification code sent if the email could be delivered.',
    expiresInSeconds: OTP_EXPIRY_MS / 1000,
    resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
  }
}

export async function verifyOtp(email, otp, purpose = 'registration') {
  const normalizedEmail = normalizeEmail(email)
  validatePurpose(purpose)

  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    throw new Error('Enter the 6-digit verification code.')
  }

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select('+otpHash')
    .sort({ createdAt: -1 })

  if (!record) {
    throw new Error('The verification code is invalid or has expired.')
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new Error(
      'Too many incorrect attempts. Request a new verification code.',
    )
  }

  if (!verifyOtpHash(otp, record.otpHash)) {
    record.attempts += 1
    await record.save()

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new Error(
        'Too many incorrect attempts. Request a new verification code.',
      )
    }

    throw new Error('The verification code is incorrect.')
  }

  record.usedAt = new Date()
  await record.save()

  return {
    email: normalizedEmail,
    purpose,
    verified: true,
  }
}