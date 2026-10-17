import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './Messenger.css'
import { connectSocket, disconnectSocket, getSocket } from './lib/socket.js'
import {
  clearConversationHistory,
  closeConversation,
  createConversation,
  deleteMessage,
  editMessage,
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

function sortConversations(items) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(
      left.lastMessageAt || left.updatedAt || 0,
    ).getTime()
    const rightTime = new Date(
      right.lastMessageAt || right.updatedAt || 0,
    ).getTime()

    return rightTime - leftTime
  })
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

  if (name === 'close') {
    return (
      <svg {...common}>
        <path d="m18 6-12 12M6 6l12 12" />
      </svg>
    )
  }

  if (name === 'trash') {
    return (
      <svg {...common}>
        <path d="M3 6h18M8 6V4h8v2m-11 0 1 14h12l1-14M10 10v6m4-6v6" />
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
  const activeIdRef = useRef('')
  const conversationsRef = useRef([])

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

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

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

  const loadConversations = useCallback(async () => {
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

        if (!currentId) return ''
        return items.length ? getId(items[0]) : ''
      })

      setError('')
      return items
    } catch (requestError) {
      setError(
        requestError.message ||
          'Could not load conversations. Please try again.',
      )
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      try {
        const result = await getConversations()
        if (cancelled) return

        const items = Array.isArray(result.conversations)
          ? result.conversations
          : []

        setConversations(items)

        if (items.length) {
          setLoadingMessages(true)
          setActiveId(getId(items[0]))
        }
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

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeId) return undefined

    let cancelled = false

    async function loadSelectedMessages() {
      try {
        const result = await getMessages(activeId, { limit: 40 })

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

    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    const socket = getSocket()

    function addMessageToConversationList(conversationId, message) {
      const known = conversationsRef.current.some(
        (item) => getId(item) === conversationId,
      )

      if (!known) {
        void loadConversations()
        return
      }

      setConversations((previous) =>
        sortConversations(
          previous.map((conversation) => {
            if (getId(conversation) !== conversationId) return conversation

            return {
              ...conversation,
              lastMessage: message,
              lastMessageText: message.text || '',
              lastMessageAt: message.createdAt || new Date().toISOString(),
            }
          }),
        ),
      )
    }

    function handleNewMessage(event) {
      const message = event?.data
      const conversationId = getId(
        event?.conversationId || message?.conversation,
      )

      if (!message || !conversationId) return

      const messageId = getId(message)
      const senderId = getId(message.sender)

      addMessageToConversationList(conversationId, message)

      if (senderId !== currentUserId) {
        socket.emit('message:delivered', {
          conversationId,
          messageId,
        })
      }

      if (activeIdRef.current !== conversationId) return

      setMessages((previous) => {
        if (previous.some((item) => getId(item) === messageId)) {
          return previous
        }

        return [...previous, message]
      })

      if (senderId !== currentUserId) {
        socket.emit('conversation:seen', { conversationId })
      }
    }

    function handleUpdatedMessage(event) {
      const message = event?.data
      const conversationId = getId(
        event?.conversationId || message?.conversation,
      )

      if (!message || !conversationId) return

      const latestConversation = conversationsRef.current.find(
        (item) => getId(item) === conversationId,
      )

      if (getId(latestConversation?.lastMessage) === getId(message)) {
        addMessageToConversationList(conversationId, message)
      }

      if (activeIdRef.current !== conversationId) return

      setMessages((previous) =>
        previous.map((item) =>
          getId(item) === getId(message) ? message : item,
        ),
      )
    }

    function handleDeletedMessage(event) {
      const conversationId = getId(event?.conversationId)
      const messageId = getId(event?.messageId)

      if (!messageId || !conversationId) return

      if (activeIdRef.current === conversationId) {
        setMessages((previous) =>
          previous.filter((item) => getId(item) !== messageId),
        )
      }

      void loadConversations()
    }

    function handleMessageStatus(event) {
      const conversationId = getId(event?.conversationId)
      const messageId = getId(event?.messageId)

      if (!messageId || activeIdRef.current !== conversationId) return

      setMessages((previous) =>
        previous.map((item) =>
          getId(item) === messageId
            ? {
                ...item,
                deliveredTo: event.deliveredTo || item.deliveredTo || [],
                readBy: event.readBy || item.readBy || [],
              }
            : item,
        ),
      )
    }

    function handleConversationClosed(event) {
      const conversationId = getId(event?.conversationId)
      if (!conversationId) return

      setConversations((previous) =>
        previous.filter((item) => getId(item) !== conversationId),
      )

      if (activeIdRef.current === conversationId) {
        setActiveId('')
        setMessages([])
        setNotice('Conversation closed.')
      }
    }

    function handleConversationCleared(event) {
      const conversationId = getId(event?.conversationId)
      if (!conversationId) return

      if (activeIdRef.current === conversationId) {
        setMessages([])
        setNotice('History cleared for your account.')
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          getId(conversation) === conversationId
            ? {
                ...conversation,
                lastMessage: null,
                lastMessageText: '',
                lastMessageAt: null,
              }
            : conversation,
        ),
      )
    }

    async function refreshAfterReconnect() {
      void loadConversations()
      const conversationId = activeIdRef.current

      if (!conversationId) return

      socket.emit('conversation:join', { conversationId })
      socket.emit('conversation:seen', { conversationId })

      try {
        const result = await getMessages(conversationId, { limit: 40 })

        if (activeIdRef.current === conversationId) {
          setMessages(Array.isArray(result.messages) ? result.messages : [])
        }
      } catch {
        // A later user action can retry if the reconnect refresh fails.
      }
    }

    socket.on('message:new', handleNewMessage)
    socket.on('message:updated', handleUpdatedMessage)
    socket.on('message:deleted', handleDeletedMessage)
    socket.on('message:status', handleMessageStatus)
    socket.on('conversation:closed', handleConversationClosed)
    socket.on('conversation:cleared', handleConversationCleared)
    socket.on('connect', refreshAfterReconnect)

    if (!socket.connected) connectSocket()

    return () => {
      socket.off('message:new', handleNewMessage)
      socket.off('message:updated', handleUpdatedMessage)
      socket.off('message:deleted', handleDeletedMessage)
      socket.off('message:status', handleMessageStatus)
      socket.off('conversation:closed', handleConversationClosed)
      socket.off('conversation:cleared', handleConversationCleared)
      socket.off('connect', refreshAfterReconnect)
      disconnectSocket()
    }
  }, [currentUserId, loadConversations])

  useEffect(() => {
    if (!activeId) return undefined

    const socket = getSocket()
    const conversationId = activeId

    function joinActiveConversation() {
      socket.emit('conversation:join', { conversationId })
      socket.emit('conversation:seen', { conversationId })
    }

    if (socket.connected) {
      joinActiveConversation()
    } else {
      socket.once('connect', joinActiveConversation)
      connectSocket()
    }

    return () => {
      socket.off('connect', joinActiveConversation)

      if (socket.connected) {
        socket.emit('conversation:leave', { conversationId })
      }
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

      await loadConversations()

      setConversations((items) => {
        const exists = items.some(
          (item) => getId(item) === getId(conversation),
        )

        return exists ? items : [conversation, ...items]
      })

      setMessages([])
      setLoadingMessages(true)
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

    const conversationId = activeId
    setSending(true)
    setError('')

    try {
      const result = await sendMessage(conversationId, text)

      if (result.data && activeIdRef.current === conversationId) {
        setMessages((previous) => {
          if (previous.some((item) => getId(item) === getId(result.data))) {
            return previous
          }

          return [...previous, result.data]
        })
      }

      setConversations((previous) =>
        sortConversations(
          previous.map((conversation) =>
            getId(conversation) === conversationId
              ? {
                  ...conversation,
                  lastMessage: result.data || { text },
                  lastMessageText: text.slice(0, 200),
                  lastMessageAt:
                    result.data?.createdAt || new Date().toISOString(),
                }
              : conversation,
          ),
        ),
      )

      setDraft('')
      composerRef.current?.focus()
    } catch (requestError) {
      setError(requestError.message || 'Your message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  async function handleEditMessage(message) {
    const nextText = window.prompt('Edit your message:', message.text || '')
    if (nextText === null) return

    const text = nextText.trim()

    if (!text) {
      setError('Message text cannot be empty.')
      return
    }

    if (text.length > 4000) {
      setError('Messages cannot exceed 4000 characters.')
      return
    }

    setError('')

    try {
      const result = await editMessage(activeId, getId(message), text)

      if (result.data) {
        setMessages((previous) =>
          previous.map((item) =>
            getId(item) === getId(result.data) ? result.data : item,
          ),
        )
      }

      setNotice('Message updated.')
    } catch (requestError) {
      setError(requestError.message || 'Could not edit this message.')
    }
  }

  async function handleDeleteMessage(message) {
    if (!window.confirm('Delete this message?')) return

    const conversationId = activeId
    setError('')

    try {
      await deleteMessage(conversationId, getId(message))

      setMessages((previous) =>
        previous.filter((item) => getId(item) !== getId(message)),
      )

      setNotice('Message deleted.')
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this message.')
    }
  }

  async function handleClearHistory() {
    if (!activeId) return

    const confirmed = window.confirm(
      'Clear the messages from your view? This will not erase the other person’s history.',
    )

    if (!confirmed) return

    const conversationId = activeId
    setWorking(true)
    setError('')

    try {
      await clearConversationHistory(conversationId)

      setMessages([])
      setConversations((previous) =>
        previous.map((conversation) =>
          getId(conversation) === conversationId
            ? {
                ...conversation,
                lastMessage: null,
                lastMessageText: '',
                lastMessageAt: null,
              }
            : conversation,
        ),
      )

      setNotice('History cleared for your account.')
    } catch (requestError) {
      setError(requestError.message || 'Could not clear this history.')
    } finally {
      setWorking(false)
    }
  }

  async function handleCloseConversation() {
    if (!activeId) return

    const confirmed = window.confirm(
      'Close this conversation? It will be hidden from your list until a new message arrives.',
    )

    if (!confirmed) return

    const conversationId = activeId
    setWorking(true)
    setError('')

    try {
      await closeConversation(conversationId)

      setConversations((previous) =>
        previous.filter((item) => getId(item) !== conversationId),
      )

      setMessages([])
      setActiveId('')
      setNotice('Conversation closed.')
    } catch (requestError) {
      setError(requestError.message || 'Could not close this conversation.')
    } finally {
      setWorking(false)
    }
  }

  async function handleSignOut() {
    if (working) return

    setWorking(true)
    setError('')

    try {
      disconnectSocket()
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
                    if (id !== activeId) {
                      setLoadingMessages(true)
                      setMessages([])
                    }

                    setActiveId(id)
                    setError('')
                    setNotice('')
                  }}
                >
                  <span className="contact-avatar">{getInitials(name)}</span>

                  <span className="conversation-item-content">
                    <span className="conversation-item-top">
                      <strong>{name}</strong>
                      <small>
                        {getTime(
                          conversation.lastMessageAt || conversation.updatedAt,
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

              <div
                className="chat-header-actions"
                style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}
              >
                <button
                  className="icon-button"
                  type="button"
                  onClick={handleClearHistory}
                  disabled={working}
                  aria-label="Clear history for your account"
                  title="Clear history for your account"
                >
                  <Icon name="trash" size={17} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={handleCloseConversation}
                  disabled={working}
                  aria-label="Close conversation"
                  title="Close conversation"
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
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
                    const mine = getId(message.sender) === currentUserId
                    const readByOther = (message.readBy || []).some(
                      (reader) => getId(reader) !== currentUserId,
                    )
                    const deliveredToOther = (
                      message.deliveredTo || []
                    ).some((reader) => getId(reader) !== currentUserId)

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
                            {message.editedAt ? ' · Edited' : ''}
                            {mine && (
                              <span className="message-delivery-status">
                                {' · '}
                                {readByOther
                                  ? 'Seen'
                                  : deliveredToOther
                                    ? 'Delivered'
                                    : 'Sent'}
                              </span>
                            )}
                          </time>

                          {mine && (
                            <div
                              className="message-actions"
                              style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleEditMessage(message)}
                                style={{
                                  border: 0,
                                  padding: '2px 4px',
                                  background: 'transparent',
                                  color: 'var(--messenger-purple)',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                                aria-label="Edit message"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(message)}
                                style={{
                                  border: 0,
                                  padding: '2px 4px',
                                  background: 'transparent',
                                  color: '#c04458',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                                aria-label="Delete message"
                              >
                                Delete
                              </button>
                            </div>
                          )}
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

            {(error || notice) && (
              <div
                className={`messenger-alert ${error ? 'alert-error' : 'alert-success'}`}
                role={error ? 'alert' : 'status'}
              >
                {error || notice}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}