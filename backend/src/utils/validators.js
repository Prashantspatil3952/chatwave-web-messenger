import { validatePassword } from './security.js'

export function normalizeEmail(email) {
  if (typeof email !== 'string') {
    return null
  }

  const value = email.trim().toLowerCase()

  if (
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    return null
  }

  return value
}

export function normalizeUserId(userId) {
  if (typeof userId !== 'string') {
    return null
  }

  const value = userId.trim().toLowerCase()

  if (!/^[a-z0-9_]{4,30}$/.test(value)) {
    return null
  }

  return value
}

export function validateDisplayName(displayName) {
  if (typeof displayName !== 'string') {
    return false
  }

  const value = displayName.trim()
  return value.length >= 2 && value.length <= 50
}

export function validateRegistrationPassword(password) {
  return validatePassword(password)
}

export function validateOtpInput(otp) {
  return typeof otp === 'string' && /^\d{6}$/.test(otp)
}