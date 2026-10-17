
import { apiRequest } from './api.js'

function post(path, data) {
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function loginAccount({
  identity,
  password,
  rememberMe = false,
}) {
  return post('/auth/login', {
    identity,
    password,
    rememberMe,
  })
}

export function requestRegistrationOtp(email) {
  return post('/auth/register/request-otp', { email })
}

export function registerAccount({
  displayName,
  userId,
  email,
  password,
  otp,
}) {
  return post('/auth/register', {
    displayName,
    userId,
    email,
    password,
    otp,
  })
}

export function requestPasswordResetOtp(email) {
  return post('/auth/forgot-password/request-otp', { email })
}

export function resetAccountPassword({ email, otp, newPassword }) {
  return post('/auth/forgot-password/reset', {
    email,
    otp,
    newPassword,
  })
}

export function getCurrentUser() {
  return apiRequest('/auth/me')
}

export function logoutAccount() {
  return post('/auth/logout', {})
}