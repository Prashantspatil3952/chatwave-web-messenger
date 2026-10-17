import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'chatwave_token'
const SESSION_TOKEN_LIFETIME = '1d'

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
      expiresIn: SESSION_TOKEN_LIFETIME,
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
  }
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