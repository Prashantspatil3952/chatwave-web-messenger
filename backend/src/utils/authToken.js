import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'chatwave_token'

export function createAuthToken(user) {
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
      expiresIn: '7d',
      issuer: 'chatwave',
      audience: 'chatwave-web',
    },
  )
}

export function getAuthCookieName() {
  return COOKIE_NAME
}

export function getAuthCookieOptions() {
  const production = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}

export function getClearCookieOptions() {
  const { maxAge, ...options } = getAuthCookieOptions()
  return options
}