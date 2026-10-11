import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { getAuthCookieName } from '../utils/authToken.js'

export async function requireAuth(req, res, next) {
  try {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      console.error('JWT_SECRET is missing from backend/.env')
      return res.status(500).json({
        message: 'Server authentication is not configured.',
      })
    }

    const cookieToken = req.cookies?.[getAuthCookieName()]
    const authorization = req.headers.authorization

    const bearerToken =
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : null

    const token = cookieToken || bearerToken

    if (!token) {
      return res.status(401).json({
        message: 'Please log in to continue.',
      })
    }

    const payload = jwt.verify(token, secret, {
      issuer: 'chatwave',
      audience: 'chatwave-web',
    })

    if (!payload.sub) {
      return res.status(401).json({
        message: 'Your session is invalid. Please log in again.',
      })
    }

    const user = await User.findById(payload.sub)

    if (!user) {
      return res.status(401).json({
        message: 'Your account could not be found.',
      })
    }

    req.user = user
    next()
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        message: 'Your session is invalid or expired. Please log in again.',
      })
    }

    next(error)
  }
}