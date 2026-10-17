
import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'chatwave_token'
const SESSION_TOKEN_LIFETIME = '1d'
const REMEMBERED_TOKEN_LIFETIME = '30d'
const SESSION_COOKIE_MAX_AGE = undefined
const REMEMBERED_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000

export function createAuthToken(user, rememberMe = false) {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is missing from backend/.env')
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      userId: user.userId,
    },
    secret,
    {
      expiresIn: rememberMe
        ? REMEMBERED_TOKEN_LIFETIME
        : SESSION_TOKEN_LIFETIME,
      issuer: 'chatwave',
      audience: 'chatwave-web',
    },
  )
}

export function getAuthCookieName() {
  return COOKIE_NAME
}

export function getAuthCookieOptions(rememberMe = false) {
  const production = process.env.NODE_ENV === 'production'

  const options = {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
  }

  if (rememberMe) {
    options.maxAge = REMEMBERED_COOKIE_MAX_AGE
  }

  return options
}

export function getClearCookieOptions() {
  const production = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
  }
}