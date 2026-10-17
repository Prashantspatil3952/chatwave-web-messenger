
import User from '../models/User.js'
import {
  comparePassword,
  hashPassword,
} from '../utils/security.js'
import {
  normalizeEmail,
  normalizeUserId,
  validateDisplayName,
  validateOtpInput,
  validateRegistrationPassword,
} from '../utils/validators.js'
import {
  createAuthToken,
  getAuthCookieName,
  getAuthCookieOptions,
  getClearCookieOptions,
} from '../utils/authToken.js'
import { requestOtp, verifyOtp } from '../services/otp.service.js'

function sendError(res, error, status = 400) {
  return res.status(status).json({
    message: error.message || 'The request could not be completed.',
  })
}

function setLoginCookie(res, user, rememberMe = false) {
  const token = createAuthToken(user, rememberMe)

  res.cookie(
    getAuthCookieName(),
    token,
    getAuthCookieOptions(rememberMe),
  )
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    userId: user.userId,
    displayName: user.displayName,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    avatarUrl: user.avatarUrl,
  }
}

export async function requestRegistrationOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)

    if (!email) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    const existingUser = await User.findOne({ email }).select('_id')

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      })
    }

    const result = await requestOtp(email, 'registration')

    return res.status(200).json(result)
  } catch (error) {
    if (error.message?.includes('verification-code requests')) {
      return sendError(res, error, 429)
    }

    if (error.message?.includes('wait ')) {
      return sendError(res, error, 429)
    }

    next(error)
  }
}

export async function register(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    const userId = normalizeUserId(req.body?.userId)
    const displayName =
      typeof req.body?.displayName === 'string'
        ? req.body.displayName.trim()
        : ''
    const { password, otp } = req.body || {}

    if (!email) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    if (!userId) {
      return res.status(400).json({
        message:
          'User ID must be 4–30 characters and contain only letters, numbers, and underscores.',
      })
    }

    if (!validateDisplayName(displayName)) {
      return res.status(400).json({
        message: 'Display name must contain 2–50 characters.',
      })
    }

    const passwordCheck = validateRegistrationPassword(password)

    if (!passwordCheck.valid) {
      return res.status(400).json({
        message: passwordCheck.message,
      })
    }

    if (!validateOtpInput(otp)) {
      return res.status(400).json({
        message: 'Enter the 6-digit verification code.',
      })
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { userId }],
    }).select('_id')

    if (existingUser) {
      return res.status(409).json({
        message: 'That email or user ID is already registered.',
      })
    }

    await verifyOtp(email, otp, 'registration')

    const passwordHash = await hashPassword(password)

    const user = await User.create({
      displayName,
      userId,
      email,
      passwordHash,
      isEmailVerified: true,
    })

    setLoginCookie(res, user)

    return res.status(201).json({
      message: 'Your ChatWave account has been created.',
      user: publicUser(user),
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'That email or user ID is already registered.',
      })
    }

    if (
      error.message?.includes('verification code') ||
      error.message?.includes('OTP_SECRET')
    ) {
      return sendError(res, error, 400)
    }

    next(error)
  }
}

export async function login(req, res, next) {
  try {
    const identity =
      typeof req.body?.identity === 'string'
        ? req.body.identity.trim().toLowerCase()
        : ''

    const { password } = req.body || {}
    const rememberMe = req.body?.rememberMe === true

    if (!identity || typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Enter your email or user ID and password.',
      })
    }

    const isEmail = identity.includes('@')

    const user = await User.findOne(
      isEmail ? { email: identity } : { userId: identity },
    ).select('+passwordHash')

    if (
      !user ||
      !(await comparePassword(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: 'Incorrect email/user ID or password.',
      })
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
      })
    }

    setLoginCookie(res, user, rememberMe)

    return res.status(200).json({
      message: 'Login successful.',
      user: publicUser(user),
    })
  } catch (error) {
    next(error)
  }
}

export async function logout(_req, res) {
  res.clearCookie(
    getAuthCookieName(),
    getClearCookieOptions(),
  )

  return res.status(200).json({
    message: 'You have been logged out.',
  })
}

export async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: publicUser(req.user),
  })
}

export async function requestPasswordResetOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)

    if (!email) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    const user = await User.findOne({ email }).select('_id')

    // Keep the same response whether or not the account exists.
    if (user) {
      try {
        await requestOtp(email, 'password-reset')
      } catch (error) {
        if (
          error.message?.includes('verification-code requests') ||
          error.message?.includes('wait ')
        ) {
          return sendError(res, error, 429)
        }

        next(error)
        return
      }
    }

    return res.status(200).json({
      message:
        'If an account exists for that email, a verification code will be sent.',
    })
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    const { otp, newPassword } = req.body || {}

    if (!email) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    const passwordCheck = validateRegistrationPassword(newPassword)

    if (!passwordCheck.valid) {
      return res.status(400).json({
        message: passwordCheck.message,
      })
    }

    if (!validateOtpInput(otp)) {
      return res.status(400).json({
        message: 'Enter the 6-digit verification code.',
      })
    }

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(400).json({
        message: 'The code is invalid or the request cannot be completed.',
      })
    }

    await verifyOtp(email, otp, 'password-reset')

    user.passwordHash = await hashPassword(newPassword)
    await user.save()

    return res.status(200).json({
      message: 'Password reset successful. You can now log in.',
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'The request could not be completed.',
      })
    }

    if (
      error.message?.includes('verification code') ||
      error.message?.includes('OTP_SECRET')
    ) {
      return sendError(res, error, 400)
    }

    next(error)
  }
}