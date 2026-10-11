import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './Messenger.css'
import {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
} from './lib/messenger.js'

function getId(value) {
  if (!value) return ''
  return String(value._id || value.id || value)
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (!parts.length) return '?'

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function getTime(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getConversationName(conversation, currentUserId) {
  if (conversation.isGroup && conversation.title) {
    return conversation.title
  }

  const otherUser = (conversation.participants || []).find(
    (participant) => getId(participant) !== currentUserId,
  )

  return otherUser?.displayName || otherUser?.userId || 'Chat'
}

function getConversationSubtitle(conversation) {
  return (
    conversation.lastMessageText ||
    conversation.lastMessage?.text ||
    'Start a conversation'
  )
}

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'search') {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    )
  }

  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }

  if (name === 'send') {
    return (
      <svg {...common}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </svg>
    )
  }

  if (name === 'message') {
    return (
      <svg {...common}>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
      </svg>
    )
  }

  if (name === 'logout') {
    return (
      <svg {...common}>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </svg>
    )
  }

  if (name === 'back') {
    return (
      <svg {...common}>
        <path d="m15 18-6-6 6-6" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export default function Messenger({ currentUser, onLogout }) {
  const currentUserId = getId(currentUser)
  const bottomRef = useRef(null)
  const composerRef = useRef(null)

  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [newUserId, setNewUserId] = useState('')
  const [draft, setDraft] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeConversation = useMemo(
    () => conversations.find((item) => getId(item) === activeId) || null,
    [conversations, activeId],
  )

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return conversations

    return conversations.filter((conversation) => {
      const name = getConversationName(conversation, currentUserId)
      const preview = getConversationSubtitle(conversation)

      return (
        name.toLowerCase().includes(query) ||
        preview.toLowerCase().includes(query)
      )
    })
  }, [conversations, currentUserId, search])

  const loadConversations = useCallback(async (initial = false) => {
    if (initial) setLoadingConversations(true)

    try {
      const result = await getConversations()
      const items = Array.isArray(result.conversations)
        ? result.conversations
        : []

      setConversations(items)

      setActiveId((currentId) => {
        if (currentId && items.some((item) => getId(item) === currentId)) {
          return currentId
        }

        return items.length ? getId(items[0]) : ''
      })

      setError('')
    } catch (requestError) {
      setError(
        requestError.message ||
          'Could not load conversations. Please try again.',
      )
    } finally {
      if (initial) setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      setLoadingConversations(true)

      try {
        const result = await getConversations()

        if (cancelled) return

        const items = Array.isArray(result.conversations)
          ? result.conversations
          : []

        setConversations(items)
        setActiveId(items.length ? getId(items[0]) : '')
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message ||
              'Could not load conversations. Please refresh.',
          )
        }
      } finally {
        if (!cancelled) setLoadingConversations(false)
      }
    }

    initialLoad()

    const refreshTimer = window.setInterval(() => {
      if (!cancelled) {
        getConversations()
          .then((result) => {
            if (cancelled) return

            const items = Array.isArray(result.conversations)
              ? result.conversations
              : []

            setConversations(items)
            setActiveId((currentId) => {
              if (
                currentId &&
                items.some((item) => getId(item) === currentId)
              ) {
                return currentId
              }

              return items.length ? getId(items[0]) : ''
            })
          })
          .catch(() => {
            // Keep the current screen visible if a background refresh fails.
          })
      }
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      setLoadingMessages(false)
      return undefined
    }

    let cancelled = false
    setLoadingMessages(true)

    async function loadSelectedMessages() {
      try {
        const result = await getMessages(activeId, { limit: 50 })

        if (!cancelled) {
          setMessages(Array.isArray(result.messages) ? result.messages : [])
          setError('')
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message ||
              'Could not load messages for this conversation.',
          )
        }
      } finally {
        if (!cancelled) setLoadingMessages(false)
      }
    }

    loadSelectedMessages()

    const refreshTimer = window.setInterval(async () => {
      try {
        const result = await getMessages(activeId, { limit: 50 })

        if (!cancelled) {
          setMessages(Array.isArray(result.messages) ? result.messages : [])
        }
      } catch {
        // Avoid interrupting a conversation because of a temporary refresh error.
      }
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeId])

  async function handleCreateConversation(event) {
    event.preventDefault()

    const userId = newUserId.trim()

    if (!userId || working) return

    setWorking(true)
    setError('')
    setNotice('')

    try {
      const result = await createConversation(userId)
      const conversation = result.conversation

      if (!conversation?._id) {
        throw new Error('The server did not return a conversation.')
      }

      await loadConversations(false)

      // Include the just-created conversation in case the list refresh races.
      setConversations((items) => {
        const exists = items.some(
          (item) => getId(item) === getId(conversation),
        )

        return exists ? items : [conversation, ...items]
      })

      setActiveId(getId(conversation))
      setNewUserId('')
      setShowNewChat(false)
      setNotice('Conversation opened.')
    } catch (requestError) {
      setError(
        requestError.message ||
          'Could not start a conversation. Check the user ID.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const text = draft.trim()

    if (!activeId || !text || sending) return

    setSending(true)
    setError('')

    try {
      const result = await sendMessage(activeId, text)

      if (result.data) {
        setMessages((previous) => {
          if (previous.some((item) => getId(item) === getId(result.data))) {
            return previous
          }

          return [...previous, result.data]
        })
      }

      setDraft('')
      composerRef.current?.focus()
      await loadConversations(false)
    } catch (requestError) {
      setError(
        requestError.message || 'Your message could not be sent.',
      )
    } finally {
      setSending(false)
    }
  }

  async function handleSignOut() {
    if (working) return

    setWorking(true)
    setError('')

    try {
      await onLogout()
    } catch (requestError) {
      setError(requestError.message || 'Sign-out failed. Try again.')
    } finally {
      setWorking(false)
    }
  }

  const activeName = activeConversation
    ? getConversationName(activeConversation, currentUserId)
    : ''

  const activeOtherUser = activeConversation?.participants?.find(
    (participant) => getId(participant) !== currentUserId,
  )

  return (
    <main className="messenger-shell">
      <aside className={`messenger-sidebar ${activeId ? 'has-active' : ''}`}>
        <div className="messenger-brand-row">
          <a
            className="messenger-brand"
            href="/"
            onClick={(event) => event.preventDefault()}
          >
            <span className="messenger-brand-mark">
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
            </span>
            <span>chatwave</span>
          </a>

          <button
            className="icon-button"
            type="button"
            onClick={() => {
              setShowNewChat((value) => !value)
              setError('')
              setNotice('')
            }}
            aria-label="Start a new conversation"
            title="New conversation"
          >
            <Icon name="plus" />
          </button>
        </div>

        <div className="messenger-sidebar-heading">
          <div>
            <h1>Messages</h1>
            <p>Stay close to your people.</p>
          </div>
          <span className="conversation-count">{conversations.length}</span>
        </div>

        {showNewChat && (
          <form className="new-chat-form" onSubmit={handleCreateConversation}>
            <label htmlFor="new-chat-user-id">Start a conversation</label>
            <div className="new-chat-fields">
              <input
                id="new-chat-user-id"
                type="text"
                value={newUserId}
                onChange={(event) => setNewUserId(event.target.value)}
                placeholder="Enter their user ID"
                minLength={4}
                maxLength={30}
                autoComplete="off"
                required
              />
              <button type="submit" disabled={working}>
                {working ? '…' : 'Start'}
              </button>
            </div>
            <small>Use the exact user ID of another ChatWave account.</small>
          </form>
        )}

        <label className="conversation-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </label>

        <div className="conversation-list">
          {loadingConversations ? (
            <div className="messenger-empty small-empty">
              <div className="loading-indicator" />
              <p>Loading your conversations…</p>
            </div>
          ) : filteredConversations.length ? (
            filteredConversations.map((conversation) => {
              const id = getId(conversation)
              const name = getConversationName(conversation, currentUserId)
              const selected = id === activeId

              return (
                <button
                  className={`conversation-item ${selected ? 'selected' : ''}`}
                  type="button"
                  key={id}
                  onClick={() => {
                    setActiveId(id)
                    setError('')
                    setNotice('')
                  }}
                >
                  <span className="contact-avatar">
                    {getInitials(name)}
                  </span>

                  <span className="conversation-item-content">
                    <span className="conversation-item-top">
                      <strong>{name}</strong>
                      <small>
                        {getTime(
                          conversation.lastMessageAt ||
                            conversation.updatedAt,
                        )}
                      </small>
                    </span>
                    <span className="conversation-preview">
                      {getConversationSubtitle(conversation)}
                    </span>
                  </span>
                </button>
              )
            })
          ) : (
            <div className="messenger-empty small-empty">
              <span className="empty-icon">
                <Icon name="message" size={22} />
              </span>
              <strong>
                {search.trim() ? 'No matches found' : 'No conversations yet'}
              </strong>
              <p>
                {search.trim()
                  ? 'Try a different search.'
                  : 'Use the + button to message another user.'}
              </p>
              {!search.trim() && (
                <button
                  type="button"
                  className="subtle-action"
                  onClick={() => setShowNewChat(true)}
                >
                  Start a chat
                </button>
              )}
            </div>
          )}
        </div>

        <div className="current-user-card">
          <span className="contact-avatar self-avatar">
            {getInitials(currentUser?.displayName)}
          </span>

          <span className="current-user-info">
            <strong>{currentUser?.displayName || 'ChatWave user'}</strong>
            <small>@{currentUser?.userId || 'user'}</small>
          </span>

          <button
            className="icon-button logout-button"
            type="button"
            onClick={handleSignOut}
            disabled={working}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <section className="messenger-chat-panel">
        {activeConversation ? (
          <>
            <header className="chat-header">
              <button
                className="icon-button mobile-back"
                type="button"
                onClick={() => setActiveId('')}
                aria-label="Back to conversations"
              >
                <Icon name="back" />
              </button>

              <span className="contact-avatar header-avatar">
                {getInitials(activeName)}
              </span>

              <div className="chat-header-info">
                <h2>{activeName}</h2>
                <p>
                  {activeConversation.isGroup
                    ? `${activeConversation.participants?.length || 0} participants`
                    : activeOtherUser?.userId
                      ? `@${activeOtherUser.userId}`
                      : 'Direct conversation'}
                </p>
              </div>

              <span className="chat-header-badge">
                <span />
                ChatWave
              </span>
            </header>

            {(error || notice) && (
              <div
                className={`messenger-alert ${error ? 'alert-error' : 'alert-success'}`}
                role={error ? 'alert' : 'status'}
              >
                <span>{error || notice}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setNotice('')
                  }}
                  aria-label="Dismiss message"
                >
                  ×
                </button>
              </div>
            )}

            <div className="chat-message-area">
              <div className="chat-date-divider">
                <span>YOUR CONVERSATION</span>
              </div>

              {loadingMessages ? (
                <div className="messenger-empty message-loading">
                  <div className="loading-indicator" />
                  <p>Loading messages…</p>
                </div>
              ) : messages.length ? (
                <div className="message-stack">
                  {messages.map((message) => {
                    const mine =
                      getId(message.sender) === currentUserId

                    return (
                      <div
                        className={`message-row ${mine ? 'own-message' : 'other-message'}`}
                        key={getId(message)}
                      >
                        {!mine && (
                          <span className="message-avatar">
                            {getInitials(message.sender?.displayName)}
                          </span>
                        )}

                        <div className="message-content">
                          {!mine && (
                            <small className="message-sender">
                              {message.sender?.displayName || 'User'}
                            </small>
                          )}

                          <div className="message-bubble">{message.text}</div>

                          <time className="message-time">
                            {getTime(message.createdAt)}
                            {mine ? ' · You' : ''}
                          </time>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              ) : (
                <div className="messenger-empty first-message">
                  <span className="empty-icon">
                    <Icon name="message" size={24} />
                  </span>
                  <h3>Say hello to {activeName}</h3>
                  <p>This is the beginning of your conversation.</p>
                </div>
              )}
            </div>

            <form className="message-composer" onSubmit={handleSendMessage}>
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${activeName}…`}
                rows={1}
                maxLength={4000}
                aria-label="Message text"
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />

              <div className="composer-footer">
                <span>Enter to send · Shift + Enter for a new line</span>
                <button
                  className="send-message-button"
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  <span>{sending ? 'Sending…' : 'Send'}</span>
                  <Icon name="send" size={17} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="chat-welcome">
            <div className="chat-welcome-mark">
              <Icon name="message" size={32} />
            </div>
            <h2>Your conversations, all in one place.</h2>
            <p>
              Choose a conversation from the sidebar or start a new one using
              another person's ChatWave user ID.
            </p>
            <button
              className="primary-action"
              type="button"
              onClick={() => setShowNewChat(true)}
            >
              <Icon name="plus" size={18} />
              Start a conversation
            </button>

            {error && (
              <div className="messenger-alert alert-error" role="alert">
                {error}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}