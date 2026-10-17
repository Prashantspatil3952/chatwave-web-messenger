import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  getCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordResetOtp,
  requestRegistrationOtp,
  resetAccountPassword,
} from './lib/auth.js'

const Messenger = lazy(() => import('./Messenger.jsx'))

function WaveMark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="13" fill="currentColor" />
      <path
        d="M8 22h5l4-9 6 15 4-9h5"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Icon({ name, size = 20 }) {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    spark: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
        <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function App() {
  const [page, setPage] = useState('login')
  const [otpSent, setOtpSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('')
  const sessionControllerRef = useRef(null)

  const [form, setForm] = useState({
    displayName: '',
    userId: '',
    identity: '',
    password: '',
    otp: '',
    newPassword: '',
  })

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    sessionControllerRef.current = controller

    getCurrentUser({ signal: controller.signal })
      .then((result) => {
        if (active && result?.user) {
          setCurrentUser(result.user)
        }
      })
      .catch(() => {
        // Visitors without a valid session can use the form immediately.
      })
      .finally(() => {
        if (active) {
          setCheckingSession(false)
        }

        if (sessionControllerRef.current === controller) {
          sessionControllerRef.current = null
        }
      })

    return () => {
      active = false
      controller.abort()

      if (sessionControllerRef.current === controller) {
        sessionControllerRef.current = null
      }
    }
  }, [])

  function updateField(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function showNotice(message, type = 'success') {
    setNotice(message)
    setNoticeType(type)
  }

  function changePage(nextPage) {
    sessionControllerRef.current?.abort()
    sessionControllerRef.current = null
    setCheckingSession(false)
    setPage(nextPage)
    setOtpSent(false)
    setShowPassword(false)
    setNotice('')
    setNoticeType('')

    setForm((previous) => ({
      ...previous,
      password: '',
      otp: '',
      newPassword: '',
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    // Stop the background check before a new authentication request.
    sessionControllerRef.current?.abort()
    sessionControllerRef.current = null
    setCheckingSession(false)

    setLoading(true)
    setNotice('')
    setNoticeType('')

    try {
      if (page === 'login') {
        const result = await loginAccount({
          identity: form.identity.trim(),
          password: form.password,
        })

        setCurrentUser(result.user)
        showNotice(result.message || 'Login successful.')
        return
      }

      if (page === 'register') {
        if (!otpSent) {
          const result = await requestRegistrationOtp(
            form.identity.trim(),
          )

          setOtpSent(true)
          showNotice(
            result.message || 'Verification code request completed.',
          )
          return
        }

        const result = await registerAccount({
          displayName: form.displayName.trim(),
          userId: form.userId.trim(),
          email: form.identity.trim(),
          password: form.password,
          otp: form.otp.trim(),
        })

        setCurrentUser(result.user)
        showNotice(result.message || 'Account created successfully.')
        return
      }

      if (page === 'forgot') {
        if (!otpSent) {
          const result = await requestPasswordResetOtp(
            form.identity.trim(),
          )

          setOtpSent(true)
          showNotice(
            result.message ||
              'If an account exists for that email, a verification code will be sent.',
          )
          return
        }

        const result = await resetAccountPassword({
          email: form.identity.trim(),
          otp: form.otp.trim(),
          newPassword: form.newPassword,
        })

        setPage('login')
        setOtpSent(false)
        setForm((previous) => ({
          ...previous,
          password: '',
          otp: '',
          newPassword: '',
        }))

        showNotice(result.message || 'Password reset successful.')
      }
    } catch (error) {
      showNotice(
        error.message || 'Something went wrong. Please try again.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (loading) return

    setLoading(true)
    setNotice('')
    setNoticeType('')

    try {
      const result =
        page === 'register'
          ? await requestRegistrationOtp(form.identity.trim())
          : await requestPasswordResetOtp(form.identity.trim())

      showNotice(
        result.message || 'A new verification-code request was processed.',
      )
    } catch (error) {
      showNotice(error.message || 'Could not resend the code.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await logoutAccount()

    setCurrentUser(null)
    setPage('login')
    setOtpSent(false)
    setNotice('')
    setNoticeType('')
    setCheckingSession(false)

    setForm({
      displayName: '',
      userId: '',
      identity: '',
      password: '',
      otp: '',
      newPassword: '',
    })
  }

  if (currentUser) {
    return (
      <Suspense
        fallback={
          <main className="auth-shell">
            <section className="form-panel">
              <div className="form-wrap">
                <div className="form-heading">
                  <span className="welcome-icon">
                    <Icon name="shield" size={23} />
                  </span>
                  <h2>Opening ChatWave</h2>
                  <p>Loading your conversations…</p>
                </div>
              </div>
            </section>
          </main>
        }
      >
        <Messenger currentUser={currentUser} onLogout={handleLogout} />
      </Suspense>
    )
  }

  const isRegister = page === 'register'
  const isForgot = page === 'forgot'

  const heading = isRegister
    ? otpSent
      ? 'Verify your email'
      : 'Create your account'
    : isForgot
      ? otpSent
        ? 'Choose a new password'
        : 'Reset your password'
      : 'Welcome back'

  const description = isRegister
    ? otpSent
      ? 'Enter the code sent to your email and complete your account details.'
      : 'A better way to stay close to your people.'
    : isForgot
      ? otpSent
        ? 'Enter your verification code and create a new password.'
        : 'Enter your email and we’ll help you get back in.'
      : 'Pick up right where your conversations left off.'

  return (
    <main className="auth-shell">
      <section className="visual-panel">
        <div className="visual-top">
          <a
            className="brand"
            href="/"
            onClick={(event) => {
              event.preventDefault()
              changePage('login')
            }}
          >
            <span className="brand-mark">
              <WaveMark />
            </span>
            <span>chatwave</span>
          </a>

          <span className="status-pill">
            <span />
            Your space to connect
          </span>
        </div>

        <div className="visual-content">
          <div className="eyebrow">
            <Icon name="spark" size={16} />
            GOOD CONVERSATIONS START HERE
          </div>

          <h1>
            Closer, even
            <br />
            when <span>apart.</span>
          </h1>

          <p className="visual-copy">
            Your people, your moments, your conversations — all in one calm,
            connected space.
          </p>

          <div className="conversation-card">
            <div className="chat-card-top">
              <div className="avatar avatar-lavender">A</div>
              <div className="contact-info">
                <strong>Alex Morgan</strong>
                <span><i /> Online now</span>
              </div>
              <span className="chat-time">Now</span>
            </div>

            <div className="bubble bubble-in">
              Hey! How have you been? 👋
            </div>
            <div className="bubble bubble-out">
              Doing great! We should catch up soon.
            </div>
            <div className="bubble bubble-in bubble-short">
              Absolutely! 😊
            </div>

            <div className="typing-row">
              <span />
              <span />
              <span />
              <small>Alex is typing</small>
            </div>
          </div>

          <div className="floating-note">
            <span className="note-icon">
              <Icon name="shield" size={19} />
            </span>
            <span>
              <strong>Your conversations matter</strong>
              <small>Designed with privacy in mind</small>
            </span>
            <Icon name="check" size={18} />
          </div>
        </div>

        <div className="visual-footer">
          <span>MEANINGFUL CONNECTIONS, MADE SIMPLE.</span>
          <span>© 2026 ChatWave</span>
        </div>
      </section>

      <section className="form-panel">
        <div className="mobile-brand">
          <span className="brand-mark">
            <WaveMark />
          </span>
          <span>chatwave</span>
        </div>

        <div className="form-wrap">
          <div className="form-heading">
            <span className="welcome-icon">
              <Icon
                name={isRegister ? 'user' : isForgot ? 'lock' : 'mail'}
                size={23}
              />
            </span>
            <h2>{heading}</h2>
            <p>{description}</p>
          </div>

          {!isForgot && (
            <div className="auth-tabs" role="tablist" aria-label="Authentication">
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={!isRegister ? 'active' : ''}
                onClick={() => changePage('login')}
              >
                Sign in
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={isRegister ? 'active' : ''}
                onClick={() => changePage('register')}
              >
                Create account
              </button>
            </div>
          )}

          {checkingSession && (
            <p className="field-hint" role="status">
              Checking for an active session in the background. You can sign in now.
            </p>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <label className="field">
                  <span>Full name</span>
                  <div className="input-wrap">
                    <Icon name="user" />
                    <input
                      name="displayName"
                      type="text"
                      placeholder="Your full name"
                      autoComplete="name"
                      value={form.displayName}
                      onChange={updateField}
                      minLength={2}
                      maxLength={50}
                      required
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Choose a user ID</span>
                  <div className="input-wrap">
                    <Icon name="user" />
                    <input
                      name="userId"
                      type="text"
                      placeholder="e.g. alex_morgan"
                      autoComplete="username"
                      value={form.userId}
                      onChange={updateField}
                      minLength={4}
                      maxLength={30}
                      pattern="[A-Za-z0-9_]{4,30}"
                      title="Use 4–30 letters, numbers, or underscores."
                      required
                    />
                  </div>
                  <small className="field-hint">
                    Use 4–30 letters, numbers, or underscores.
                  </small>
                </label>
              </>
            )}

            <label className="field">
              <span>
                {isForgot || isRegister
                  ? 'Email address'
                  : 'Email or user ID'}
              </span>
              <div className="input-wrap">
                <Icon name={isRegister || isForgot ? 'mail' : 'user'} />
                <input
                  name="identity"
                  type={isRegister || isForgot ? 'email' : 'text'}
                  placeholder={
                    isRegister || isForgot
                      ? 'you@example.com'
                      : 'Enter email or user ID'
                  }
                  autoComplete={
                    isRegister || isForgot ? 'email' : 'username'
                  }
                  value={form.identity}
                  onChange={updateField}
                  disabled={otpSent}
                  required
                />
              </div>
            </label>

            {!isForgot && (
              <label className="field">
                <span>Password</span>
                <div className="input-wrap">
                  <Icon name="lock" />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={
                      isRegister
                        ? 'Create a password'
                        : 'Enter your password'
                    }
                    autoComplete={
                      isRegister ? 'new-password' : 'current-password'
                    }
                    value={form.password}
                    onChange={updateField}
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name="eye" size={18} />
                  </button>
                </div>

                {isRegister && (
                  <small className="field-hint">
                    Use at least 6 characters.
                  </small>
                )}
              </label>
            )}

            {isForgot && otpSent && (
              <label className="field">
                <span>New password</span>
                <div className="input-wrap">
                  <Icon name="lock" />
                  <input
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a new password"
                    autoComplete="new-password"
                    value={form.newPassword}
                    onChange={updateField}
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name="eye" size={18} />
                  </button>
                </div>
                <small className="field-hint">
                  Use at least 6 characters.
                </small>
              </label>
            )}

            {((isRegister && otpSent) || (isForgot && otpSent)) && (
              <label className="field">
                <span>6-digit email verification code</span>
                <div className="input-wrap">
                  <Icon name="shield" />
                  <input
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    value={form.otp}
                    onChange={updateField}
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </div>
                <small className="field-hint">
                  The code expires after 5 minutes.
                </small>
              </label>
            )}

            {!isRegister && !isForgot && (
              <div className="form-options">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => changePage('forgot')}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {notice && (
              <div
                className={`notice ${noticeType}`}
                role={noticeType === 'error' ? 'alert' : 'status'}
              >
                {notice}
              </div>
            )}

            <button
              className="submit-button"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? 'Please wait…'
                  : isRegister
                    ? otpSent
                      ? 'Verify & create account'
                      : 'Send verification code'
                    : isForgot
                      ? otpSent
                        ? 'Reset password'
                        : 'Send reset code'
                      : 'Sign in to ChatWave'}
              </span>
              <Icon name="arrow" size={19} />
            </button>

            {otpSent && (
              <button
                type="button"
                className="text-link"
                onClick={handleResendOtp}
                disabled={loading}
              >
                Resend verification code
              </button>
            )}
          </form>

          {isForgot && (
            <button
              type="button"
              className="back-link"
              onClick={() => changePage('login')}
            >
              <span>←</span> Back to sign in
            </button>
          )}

          {isRegister && (
            <p className="terms-copy">
              By creating an account, you agree to our{' '}
              <a href="#terms" onClick={(event) => event.preventDefault()}>
                Terms
              </a>{' '}
              and{' '}
              <a href="#privacy" onClick={(event) => event.preventDefault()}>
                Privacy Policy
              </a>.
            </p>
          )}

          <div className="form-bottom">
            <span className="secure-icon">
              <Icon name="shield" size={16} />
            </span>
            <span>Your conversations belong to you.</span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App