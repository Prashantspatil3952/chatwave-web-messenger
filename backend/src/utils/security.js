
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

// A password only needs six characters.
// No uppercase, lowercase, number or special character rules.
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    return {
      valid: false,
      message: 'Password must contain at least 6 characters.',
    }
  }

  return {
    valid: true,
    message: 'Password is valid.',
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString()
}

export function hashOtp(otp) {
  const secret = process.env.OTP_SECRET

  if (!secret) {
    throw new Error('OTP_SECRET is missing from backend/.env')
  }

  return crypto
    .createHmac('sha256', secret)
    .update(String(otp))
    .digest('hex')
}

export function verifyOtpHash(otp, storedHash) {
  if (typeof otp !== 'string' || typeof storedHash !== 'string') {
    return false
  }

  const submittedHash = hashOtp(otp)

  const submittedBuffer = Buffer.from(submittedHash, 'hex')
  const storedBuffer = Buffer.from(storedHash, 'hex')

  return (
    submittedBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, storedBuffer)
  )
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString('hex')
}