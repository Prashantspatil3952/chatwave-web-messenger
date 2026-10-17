import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './Messenger.css'
import './MessengerFeatures.css'
import { connectSocket, disconnectSocket, getSocket } from './lib/socket.js'
import { getFileUrl } from './lib/api.js'
import {
  clearConversationHistory,
  closeConversation,
  createConversation,
  deleteMessage,
  editMessage,
  getConversations,
  getMessages,
  sendMessage,
  updateProfile,
  uploadAvatar,
  uploadConversationFile,
} from './lib/messenger.js'

const MAX_FILE_BYTES = 35 * 1024 * 1024
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const FILE_ACCEPT =
  '.jpg,.jpeg,.png,.gif,.webp,.avif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx'

function getId(value) {
  if (!value) return ''
  return String(value._id || value.id || value)
}

function getFileId(value) {
  return String(value || '').replace(/^\/api\/files\//, '')
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  return parts.length
    ? parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('')
    : '?'
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

function getLastSeen(value) {
  if (!value) return 'Offline'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Offline'

  return `Last seen ${date.toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short',
  })}`
}

function getConversationName(conversation, currentUserId) {
  if (conversation.isGroup && conversation.title) {
    return conversation.title
  }

  const other = (conversation.participants || []).find(
    (participant) => getId(participant) !== currentUserId,
  )

  return other?.displayName || other?.userId || 'Chat'
}

function getPreview(message) {
  if (!message) return ''
  if (message.type === 'image') return 'Photo'
  if (message.type === 'audio') return 'Voice message'

  if (message.type === 'file') {
    return message.attachment?.name || 'File'
  }

  return message.text || ''
}

function getConversationSubtitle(conversation) {
  return (
    conversation.lastMessageText ||
    getPreview(conversation.lastMessage) ||
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

function makeCallId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
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

  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    message: (
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
    back: <path d="m15 18-6-6 6-6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    trash: (
      <path d="M3 6h18M8 6V4h8v2m-11 0 1 14h12l1-14M10 10v6m4-6v6" />
    ),
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 8.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z" />
    ),
    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    paperclip: (
      <path d="m21.4 11.1-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    ),
    mic: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </>
    ),
    camera: (
      <>
        <path d="M14 4h-4l-2 3H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-2-3Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    mute: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="m17 9 5 6m0-6-5 6" />
      </>
    ),
  }

  return <svg {...common}>{paths[name] || <circle cx="12" cy="12" r="9" />}</svg>
}

function RemoteBlob({ fileRef, kind, name }) {
  const [src, setSrc] = useState('')
  const [loadError, setLoadError] = useState(false)

  const value = String(fileRef || '')
  const url = /^https?:\/\//i.test(value)
    ? value
    : getFileUrl(getFileId(value))

  useEffect(() => {
    if (kind !== 'image' || !fileRef) return undefined

    let cancelled = false
    let objectUrl = ''

    fetch(url, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('File could not be loaded.')
        }

        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return

        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [fileRef, kind, url])

  if (kind === 'audio') {
    return (
      <audio
        className="feature-audio-player"
        controls
        preload="none"
        crossOrigin="use-credentials"
        src={url}
      >
        Your browser cannot play this voice message.
      </audio>
    )
  }

  if (kind === 'file') {
    return (
      <a
        className="feature-file-download"
        href={url}
        download={name || 'download'}
      >
        <Icon name="download" size={16} />
        {name || 'Download file'}
      </a>
    )
  }

  if (loadError) {
    return (
      <span className="feature-file-error">
        {name || 'Image'} could not be loaded.
      </span>
    )
  }

  if (!src) {
    return (
      <span className="feature-file-loading">
        Loading {name || 'image'}…
      </span>
    )
  }

  return (
    <a
      className="feature-image-link"
      href={src}
      target="_blank"
      rel="noreferrer"
    >
      <img
        className="feature-image-preview"
        src={src}
        alt={name || 'Shared image'}
        loading="lazy"
      />
    </a>
  )
}

function Avatar({ user, name = '', className = '' }) {
  const avatarUrl = user?.avatarUrl || ''
  const [failedSource, setFailedSource] = useState('')
  const avatarId = getFileId(avatarUrl)

  const src =
    avatarUrl &&
    (/^https?:\/\//i.test(avatarUrl)
      ? avatarUrl
      : getFileUrl(avatarId))

  return (
    <span className={`contact-avatar ${className}`}>
      {src && failedSource !== src ? (
        <img
          src={src}
          alt=""
          crossOrigin="use-credentials"
          onError={() => setFailedSource(src)}
        />
      ) : (
        getInitials(name || user?.displayName || user?.userId)
      )}
    </span>
  )
}

export default function Messenger({ currentUser, onLogout }) {
  const [profileUser, setProfileUser] = useState(currentUser)
  const currentUserId = getId(profileUser)

  const bottomRef = useRef(null)
  const composerRef = useRef(null)
  const fileInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const activeIdRef = useRef('')
  const conversationsRef = useRef([])
  const callRef = useRef(null)
  const incomingCallRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingIceRef = useRef(new Map())
  const recorderRef = useRef(null)
  const recordingStreamRef = useRef(null)

  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [newIdentity, setNewIdentity] = useState('')
  const [draft, setDraft] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [working, setWorking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [presence, setPresence] = useState({})
  const [showProfile, setShowProfile] = useState(false)
  const [profileName, setProfileName] = useState(
    currentUser?.displayName || '',
  )
  const [incomingCall, setIncomingCall] = useState(null)
  const [callState, setCallState] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)

  const publishCall = useCallback((next) => {
    callRef.current = next
    setCallState(next)
  }, [])

  const resetCall = useCallback(() => {
    try {
      pcRef.current?.close()
    } catch {
      // The peer connection may already be closed.
    }

    pcRef.current = null

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null

    setLocalStream(null)
    setRemoteStream(null)

    pendingIceRef.current.clear()
    callRef.current = null
    setCallState(null)

    incomingCallRef.current = null
    setIncomingCall(null)

    setMuted(false)
    setCameraOff(false)
  }, [])

  const loadConversations = useCallback(async (showErrors = true) => {
    try {
      const result = await getConversations()
      const items = Array.isArray(result.conversations)
        ? result.conversations
        : []

      setConversations(items)

      const currentId = activeIdRef.current
      const activeStillExists =
        currentId && items.some((item) => getId(item) === currentId)

      if (currentId && !activeStillExists) {
        setMessages([])
        setLoadingMessages(items.length > 0)
        setActiveId(items.length ? getId(items[0]) : '')
      }

      setError((old) => (showErrors ? '' : old))

      return items
    } catch (requestError) {
      if (showErrors) {
        setError(
          requestError.message ||
            'Could not load conversations. Please try again.',
        )
      }

      return null
    }
  }, [])

  const activeConversation = useMemo(
    () =>
      conversations.find((item) => getId(item) === activeId) || null,
    [conversations, activeId],
  )

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return conversations

    return conversations.filter((conversation) => {
      const other = (conversation.participants || []).find(
        (participant) => getId(participant) !== currentUserId,
      )

      return [
        getConversationName(conversation, currentUserId),
        getConversationSubtitle(conversation),
        other?.userId,
        other?.email,
      ].some((value) =>
        String(value || '').toLowerCase().includes(query),
      )
    })
  }, [conversations, currentUserId, search])

  const activeOtherUser = activeConversation?.participants?.find(
    (participant) => getId(participant) !== currentUserId,
  )

  const activeName = activeConversation
    ? getConversationName(activeConversation, currentUserId)
    : ''

  const activePresence = activeOtherUser
    ? presence[getId(activeOtherUser)] || {
        online: Boolean(activeOtherUser.isOnline),
        lastSeenAt: activeOtherUser.lastSeenAt,
      }
    : null

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    let cancelled = false

    getConversations()
      .then((result) => {
        if (cancelled) return

        const items = Array.isArray(result.conversations)
          ? result.conversations
          : []

        setConversations(items)

        if (items.length) {
          setLoadingMessages(true)
          setActiveId(getId(items[0]))
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError.message ||
              'Could not load conversations. Please refresh.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConversations(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeId) return undefined

    let cancelled = false

    getMessages(activeId, { limit: 40 })
      .then((result) => {
        if (!cancelled) {
          setMessages(
            Array.isArray(result.messages) ? result.messages : [],
          )
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError.message ||
              'Could not load messages for this conversation.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeId])

  const makePeerConnection = useCallback(
    (callId, stream) => {
      if (typeof RTCPeerConnection === 'undefined') {
        throw new Error('This browser does not support WebRTC calls.')
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      })

      pcRef.current = peer

      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream)
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          getSocket().emit('call:ice-candidate', {
            callId,
            candidate: event.candidate.toJSON
              ? event.candidate.toJSON()
              : event.candidate,
          })
        }
      }

      peer.ontrack = (event) => {
        const streamFromEvent = event.streams?.[0]

        if (streamFromEvent) {
          setRemoteStream(streamFromEvent)
        } else {
          setRemoteStream((previous) => {
            const next = previous || new MediaStream()
            next.addTrack(event.track)
            return next
          })
        }
      }

      peer.onconnectionstatechange = () => {
        const active = callRef.current

        if (!active || active.callId !== callId) return

        if (peer.connectionState === 'connected') {
          publishCall({
            ...active,
            phase: 'connected',
          })
        }

        if (peer.connectionState === 'failed') {
          setError(
            'The call could not connect. Your network may require a TURN relay service.',
          )
        }

        if (peer.connectionState === 'disconnected') {
          setNotice(
            'Call connection interrupted. Trying to recover…',
          )
        }

        if (peer.connectionState === 'closed') {
          setRemoteStream(null)
        }
      }

      return peer
    },
    [publishCall],
  )

  const flushPendingIce = useCallback(async (callId, peer) => {
    const candidates = pendingIceRef.current.get(callId) || []
    pendingIceRef.current.delete(callId)

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate)
      } catch (iceError) {
        console.warn(
          'Could not add a queued call candidate:',
          iceError.message,
        )
      }
    }
  }, [])

  const startCallerMedia = useCallback(
    async (callId) => {
      const active = callRef.current

      if (
        !active ||
        active.callId !== callId ||
        active.role !== 'caller'
      ) {
        return
      }

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Allow camera and microphone access in a supported browser to make calls.',
          )
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: active.mode === 'video',
        })

        if (callRef.current?.callId !== callId) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        localStreamRef.current = stream
        setLocalStream(stream)

        publishCall({
          ...callRef.current,
          phase: 'connecting',
        })

        const peer = makePeerConnection(callId, stream)
        const offer = await peer.createOffer()

        await peer.setLocalDescription(offer)

        getSocket().emit('call:offer', {
          callId,
          offer: {
            type: peer.localDescription.type,
            sdp: peer.localDescription.sdp,
          },
        })
      } catch (callError) {
        getSocket().emit('call:end', { callId })
        resetCall()

        setError(
          callError.message ||
            'Could not access the microphone or camera.',
        )
      }
    },
    [makePeerConnection, publishCall, resetCall],
  )

  const handleRemoteOffer = useCallback(
    async (event) => {
      const active = callRef.current
      const peer = pcRef.current

      if (
        !active ||
        active.callId !== event.callId ||
        active.role !== 'callee' ||
        !peer
      ) {
        return
      }

      try {
        await peer.setRemoteDescription(event.offer)
        await flushPendingIce(event.callId, peer)

        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)

        getSocket().emit('call:answer', {
          callId: event.callId,
          answer: {
            type: peer.localDescription.type,
            sdp: peer.localDescription.sdp,
          },
        })
      } catch (callError) {
        setError(
          callError.message ||
            'Could not establish the call connection.',
        )

        getSocket().emit('call:end', { callId: event.callId })
        resetCall()
      }
    },
    [flushPendingIce, resetCall],
  )

  const handleRemoteAnswer = useCallback(
    async (event) => {
      const active = callRef.current
      const peer = pcRef.current

      if (
        !active ||
        active.callId !== event.callId ||
        !peer
      ) {
        return
      }

      try {
        await peer.setRemoteDescription(event.answer)
        await flushPendingIce(event.callId, peer)
      } catch (callError) {
        setError(
          callError.message ||
            'Could not complete the call connection.',
        )

        getSocket().emit('call:end', { callId: event.callId })
        resetCall()
      }
    },
    [flushPendingIce, resetCall],
  )

  const handleRemoteCandidate = useCallback(async (event) => {
    if (!event?.candidate) return

    const peer = pcRef.current

    if (!peer || callRef.current?.callId !== event.callId) return

    try {
      if (peer.remoteDescription) {
        await peer.addIceCandidate(event.candidate)
      } else {
        const items =
          pendingIceRef.current.get(event.callId) || []

        items.push(event.candidate)
        pendingIceRef.current.set(event.callId, items)
      }
    } catch (iceError) {
      console.warn(
        'Could not add call network candidate:',
        iceError.message,
      )
    }
  }, [])

  useEffect(() => {
    const socket = getSocket()

    function updateConversationPreview(
      conversationId,
      message,
      senderId,
    ) {
      const exists = conversationsRef.current.some(
        (item) => getId(item) === conversationId,
      )

      if (!exists) {
        void loadConversations(false)
        return
      }

      setConversations((previous) =>
        sortConversations(
          previous.map((conversation) => {
            if (getId(conversation) !== conversationId) {
              return conversation
            }

            const isIncoming =
              senderId && senderId !== currentUserId

            const shouldCountUnread =
              isIncoming &&
              activeIdRef.current !== conversationId

            return {
              ...conversation,
              lastMessage: message,
              lastMessageText: getPreview(message).slice(0, 200),
              lastMessageAt:
                message.createdAt || new Date().toISOString(),
              unreadCount: shouldCountUnread
                ? (Number(conversation.unreadCount) || 0) + 1
                : activeIdRef.current === conversationId
                  ? 0
                  : Number(conversation.unreadCount) || 0,
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

      updateConversationPreview(
        conversationId,
        message,
        senderId,
      )

      if (senderId !== currentUserId) {
        socket.emit('message:delivered', {
          conversationId,
          messageId,
        })

        const shouldNotify =
          document.visibilityState === 'hidden' ||
          activeIdRef.current !== conversationId

        if (
          shouldNotify &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const body =
            message.type === 'image'
              ? 'Sent a photo'
              : message.type === 'audio'
                ? 'Sent a voice message'
                : message.type === 'file'
                  ? `Sent ${message.attachment?.name || 'a file'}`
                  : message.text

          try {
            const notification = new Notification(
              message.sender?.displayName ||
                'New ChatWave message',
              {
                body: String(body || '').slice(0, 180),
                tag: `chatwave-${conversationId}`,
              },
            )

            notification.onclick = () => {
              window.focus()
              setActiveId(conversationId)
              notification.close()
            }
          } catch {
            // The browser may block notifications while inactive.
          }
        }
      }

      if (activeIdRef.current !== conversationId) return

      setMessages((previous) =>
        previous.some((item) => getId(item) === messageId)
          ? previous
          : [...previous, message],
      )

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

      setConversations((previous) =>
        previous.map((conversation) =>
          getId(conversation) === conversationId &&
          getId(conversation.lastMessage) === getId(message)
            ? {
                ...conversation,
                lastMessage: message,
                lastMessageText: getPreview(message).slice(0, 200),
              }
            : conversation,
        ),
      )

      if (activeIdRef.current === conversationId) {
        setMessages((previous) =>
          previous.map((item) =>
            getId(item) === getId(message) ? message : item,
          ),
        )
      }
    }

    function handleDeletedMessage(event) {
      const conversationId = getId(event?.conversationId)
      const messageId = getId(event?.messageId)

      if (!conversationId || !messageId) return

      if (activeIdRef.current === conversationId) {
        setMessages((previous) =>
          previous.filter((item) => getId(item) !== messageId),
        )
      }

      void loadConversations(false)
    }

    function handleMessageStatus(event) {
      const conversationId = getId(event?.conversationId)
      const messageId = getId(event?.messageId)

      if (
        !messageId ||
        activeIdRef.current !== conversationId
      ) {
        return
      }

      setMessages((previous) =>
        previous.map((item) =>
          getId(item) === messageId
            ? {
                ...item,
                deliveredTo:
                  event.deliveredTo || item.deliveredTo || [],
                readBy: event.readBy || item.readBy || [],
              }
            : item,
        ),
      )
    }

    function handlePresence(event) {
      const userId = getId(event?.userId)

      if (!userId) return

      setPresence((previous) => ({
        ...previous,
        [userId]: {
          online: Boolean(event.online),
          lastSeenAt: event.lastSeenAt || null,
        },
      }))

      setConversations((previous) =>
        previous.map((conversation) => ({
          ...conversation,
          participants: (conversation.participants || []).map(
            (person) =>
              getId(person) === userId
                ? {
                    ...person,
                    isOnline: Boolean(event.online),
                    lastSeenAt:
                      event.lastSeenAt || person.lastSeenAt,
                  }
                : person,
          ),
        })),
      )
    }

    function handleClosed(event) {
      const conversationId = getId(event?.conversationId)

      if (!conversationId) return

      setConversations((previous) =>
        previous.filter(
          (item) => getId(item) !== conversationId,
        ),
      )

      if (activeIdRef.current === conversationId) {
        setActiveId('')
        setMessages([])
        setLoadingMessages(false)
        setNotice('Conversation closed.')
      }
    }

    function handleCleared(event) {
      const conversationId = getId(event?.conversationId)

      if (!conversationId) return

      if (activeIdRef.current === conversationId) {
        setMessages([])
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          getId(conversation) === conversationId
            ? {
                ...conversation,
                lastMessage: null,
                lastMessageText: '',
                lastMessageAt: null,
                unreadCount: 0,
              }
            : conversation,
        ),
      )
    }

    async function refreshAfterReconnect() {
      void loadConversations(false)

      const conversationId = activeIdRef.current

      if (!conversationId) return

      socket.emit('conversation:join', { conversationId })
      socket.emit('conversation:seen', { conversationId })

      try {
        const result = await getMessages(conversationId, {
          limit: 40,
        })

        if (activeIdRef.current === conversationId) {
          setMessages(
            Array.isArray(result.messages)
              ? result.messages
              : [],
          )
        }
      } catch {
        // Opening the conversation again can retry the request.
      }
    }

    function handleIncomingCall(event) {
      if (!event?.callId) return

      if (callRef.current || incomingCallRef.current) {
        socket.emit('call:reject', {
          callId: event.callId,
          reason: 'busy',
        })
        return
      }

      incomingCallRef.current = event
      setIncomingCall(event)

      if (
        document.visibilityState === 'hidden' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification('Incoming ChatWave call', {
            body: `${event.caller?.displayName || 'Someone'} is calling you.`,
          })
        } catch {
          // Browser notifications may be restricted.
        }
      }
    }

    function handleCallAccepted(event) {
      if (callRef.current?.callId === event.callId) {
        void startCallerMedia(event.callId)
      }
    }

    function handleCallClosed(event) {
      const callId = event?.callId

      if (callRef.current?.callId === callId) {
        resetCall()

        if (event.reason === 'connection-lost') {
          setError('The other person disconnected from the call.')
        } else if (event.reason === 'unanswered') {
          setNotice('No answer. The call timed out.')
        } else if (event.reason === 'missed') {
          setNotice('Missed call.')
        } else if (event.reason === 'ended') {
          setNotice('Call ended.')
        }
      }

      if (incomingCallRef.current?.callId === callId) {
        incomingCallRef.current = null
        setIncomingCall(null)
      }
    }

    function handleCallRejected(event) {
      if (callRef.current?.callId !== event?.callId) return

      resetCall()

      setNotice(
        event.reason === 'busy'
          ? 'The other user is busy.'
          : 'The call was declined.',
      )
    }

    function handleCallProblem(event) {
      if (
        event?.callId &&
        callRef.current?.callId !== event.callId
      ) {
        return
      }

      resetCall()
      setError(event?.message || 'The call could not be completed.')
    }

    function handleProfileUpdated(event) {
      if (getId(event?.user) === currentUserId) {
        setProfileUser(event.user)
      }

      if (event?.user?.id) {
        setConversations((previous) =>
          previous.map((conversation) => ({
            ...conversation,
            participants: (conversation.participants || []).map(
              (person) =>
                getId(person) === getId(event.user)
                  ? { ...person, ...event.user }
                  : person,
            ),
          })),
        )
      }
    }

    function handleConversationRead(event) {
      if (getId(event?.readByUserId) !== currentUserId) return

      setConversations((previous) =>
        previous.map((conversation) =>
          getId(conversation) === getId(event.conversationId)
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      )
    }

    function handleCallAnsweredElsewhere(event) {
      if (incomingCallRef.current?.callId === event?.callId) {
        incomingCallRef.current = null
        setIncomingCall(null)
      }
    }

    function handleSocketConnectError(socketError) {
      if (callRef.current) {
        resetCall()

        setError(
          socketError?.message ||
            'Realtime connection failed. Check your connection and sign in again if needed.',
        )
      }
    }

    socket.on('message:new', handleNewMessage)
    socket.on('message:updated', handleUpdatedMessage)
    socket.on('message:deleted', handleDeletedMessage)
    socket.on('message:status', handleMessageStatus)
    socket.on('conversation:closed', handleClosed)
    socket.on('conversation:cleared', handleCleared)
    socket.on('presence:update', handlePresence)
    socket.on('profile:updated', handleProfileUpdated)
    socket.on('conversation:read', handleConversationRead)

    socket.on('call:incoming', handleIncomingCall)
    socket.on('call:accepted', handleCallAccepted)
    socket.on('call:offer', handleRemoteOffer)
    socket.on('call:answer', handleRemoteAnswer)
    socket.on('call:ice-candidate', handleRemoteCandidate)
    socket.on('call:ended', handleCallClosed)
    socket.on('call:rejected', handleCallRejected)
    socket.on('call:busy', handleCallProblem)
    socket.on('call:unavailable', handleCallProblem)
    socket.on('call:error', handleCallProblem)
    socket.on('call:answered-elsewhere', handleCallAnsweredElsewhere)

    socket.on('connect', refreshAfterReconnect)
    socket.on('connect_error', handleSocketConnectError)

    if (!socket.connected) {
      connectSocket()
    }

    return () => {
      socket.off('message:new', handleNewMessage)
      socket.off('message:updated', handleUpdatedMessage)
      socket.off('message:deleted', handleDeletedMessage)
      socket.off('message:status', handleMessageStatus)
      socket.off('conversation:closed', handleClosed)
      socket.off('conversation:cleared', handleCleared)
      socket.off('presence:update', handlePresence)
      socket.off('profile:updated', handleProfileUpdated)
      socket.off('conversation:read', handleConversationRead)

      socket.off('call:incoming', handleIncomingCall)
      socket.off('call:accepted', handleCallAccepted)
      socket.off('call:offer', handleRemoteOffer)
      socket.off('call:answer', handleRemoteAnswer)
      socket.off('call:ice-candidate', handleRemoteCandidate)
      socket.off('call:ended', handleCallClosed)
      socket.off('call:rejected', handleCallRejected)
      socket.off('call:busy', handleCallProblem)
      socket.off('call:unavailable', handleCallProblem)
      socket.off('call:error', handleCallProblem)
      socket.off('call:answered-elsewhere', handleCallAnsweredElsewhere)

      socket.off('connect', refreshAfterReconnect)
      socket.off('connect_error', handleSocketConnectError)

      disconnectSocket()
      resetCall()

      if (
        recorderRef.current &&
        recorderRef.current.state !== 'inactive'
      ) {
        recorderRef.current.stop()
      }

      recordingStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop())
    }
  }, [
    currentUserId,
    loadConversations,
    handleRemoteAnswer,
    handleRemoteCandidate,
    handleRemoteOffer,
    resetCall,
    startCallerMedia,
  ])

  useEffect(() => {
    if (!activeId) return undefined

    const socket = getSocket()
    const conversationId = activeId

    const join = () => {
      socket.emit('conversation:join', { conversationId })
      socket.emit('conversation:seen', { conversationId })
    }

    if (socket.connected) {
      join()
    } else {
      socket.once('connect', join)
      connectSocket()
    }

    return () => {
      socket.off('connect', join)

      if (socket.connected) {
        socket.emit('conversation:leave', { conversationId })
      }
    }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages, activeId])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }

    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }

    if (
      remoteAudioRef.current &&
      remoteStream &&
      callState?.mode !== 'video'
    ) {
      remoteAudioRef.current.srcObject = remoteStream
    }
  }, [localStream, remoteStream, callState])

  useEffect(() => {
    if (!incomingCall) return undefined

    let context = null
    let interval = null

    const beep = () => {
      try {
        const AudioContextConstructor =
          window.AudioContext || window.webkitAudioContext

        if (!AudioContextConstructor) return

        context = new AudioContextConstructor()

        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = 660
        gain.gain.value = 0.045

        oscillator.connect(gain)
        gain.connect(context.destination)

        oscillator.start()
        oscillator.stop(context.currentTime + 0.22)

        oscillator.onended = () => {
          void context?.close()
        }
      } catch {
        // Browsers may block ringtone audio before user interaction.
      }
    }

    beep()
    interval = window.setInterval(beep, 1800)

    return () => {
      if (interval) {
        window.clearInterval(interval)
      }

      if (context && context.state !== 'closed') {
        void context.close().catch(() => {})
      }
    }
  }, [incomingCall])

  async function handleCreateConversation(event) {
    event.preventDefault()

    const identity = newIdentity.trim()

    if (!identity || working) return

    setWorking(true)
    setError('')
    setNotice('')

    try {
      const result = await createConversation(identity)
      const conversation = result.conversation

      if (!conversation?._id) {
        throw new Error('The server did not return a conversation.')
      }

      const refreshed = await loadConversations(false)

      setConversations((previous) => {
        const base = refreshed || previous

        return sortConversations([
          conversation,
          ...base.filter(
            (item) => getId(item) !== getId(conversation),
          ),
        ])
      })

      setMessages([])
      setLoadingMessages(true)
      setActiveId(getId(conversation))

      setNewIdentity('')
      setShowNewChat(false)

      setNotice(
        result.message ||
          'Conversation opened. You can send a message now.',
      )
    } catch (requestError) {
      setError(
        requestError.message ||
          'Could not start a conversation. Check the user ID or email address.',
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

      if (
        result.data &&
        activeIdRef.current === conversationId
      ) {
        setMessages((previous) =>
          previous.some(
            (item) => getId(item) === getId(result.data),
          )
            ? previous
            : [...previous, result.data],
        )
      }

      setConversations((previous) =>
        sortConversations(
          previous.map((conversation) =>
            getId(conversation) === conversationId
              ? {
                  ...conversation,
                  lastMessage:
                    result.data || { text, type: 'text' },
                  lastMessageText: text.slice(0, 200),
                  lastMessageAt:
                    result.data?.createdAt ||
                    new Date().toISOString(),
                  unreadCount: 0,
                }
              : conversation,
          ),
        ),
      )

      setDraft('')
      composerRef.current?.focus()
    } catch (requestError) {
      setError(
        requestError.message || 'Your message could not be sent.',
      )
    } finally {
      setSending(false)
    }
  }

  async function handleEditMessage(message) {
    const nextText = window.prompt(
      'Edit your message:',
      message.text || '',
    )

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
      const result = await editMessage(
        activeId,
        getId(message),
        text,
      )

      if (result.data) {
        setMessages((previous) =>
          previous.map((item) =>
            getId(item) === getId(result.data)
              ? result.data
              : item,
          ),
        )
      }

      setNotice('Message updated.')
    } catch (requestError) {
      setError(
        requestError.message || 'Could not edit this message.',
      )
    }
  }

  async function handleDeleteMessage(message) {
    if (!window.confirm('Delete this message?')) return

    try {
      await deleteMessage(activeId, getId(message))

      setMessages((previous) =>
        previous.filter(
          (item) => getId(item) !== getId(message),
        ),
      )

      setNotice('Message deleted.')
    } catch (requestError) {
      setError(
        requestError.message || 'Could not delete this message.',
      )
    }
  }

  async function handleClearHistory() {
    if (
      !activeId ||
      !window.confirm(
        'Clear the messages from your view? This does not erase the other person’s history.',
      )
    ) {
      return
    }

    setWorking(true)

    try {
      await clearConversationHistory(activeId)
      setMessages([])

      setConversations((previous) =>
        previous.map((conversation) =>
          getId(conversation) === activeId
            ? {
                ...conversation,
                lastMessage: null,
                lastMessageText: '',
                lastMessageAt: null,
                unreadCount: 0,
              }
            : conversation,
        ),
      )

      setNotice('History cleared for your account.')
    } catch (requestError) {
      setError(
        requestError.message || 'Could not clear this history.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleCloseConversation() {
    if (
      !activeId ||
      !window.confirm(
        'Close this conversation? It will be hidden until a new message arrives.',
      )
    ) {
      return
    }

    const conversationId = activeId

    setWorking(true)

    try {
      await closeConversation(conversationId)

      setConversations((previous) =>
        previous.filter(
          (item) => getId(item) !== conversationId,
        ),
      )

      setMessages([])
      setActiveId('')
      setLoadingMessages(false)
      setNotice('Conversation closed.')
    } catch (requestError) {
      setError(
        requestError.message || 'Could not close this conversation.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (!files.length || !activeId) return

    const conversationId = activeId

    setUploading(true)
    setError('')

    let sentCount = 0
    let failedCount = 0

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `${file.name}: the maximum file size is 35 MB.`,
        )

        failedCount += 1
        continue
      }

      if (!file.size) {
        setError(`${file.name}: empty files cannot be sent.`)
        failedCount += 1
        continue
      }

      try {
        const result = await uploadConversationFile(
          conversationId,
          file,
        )

        if (result.data) {
          setMessages((previous) =>
            previous.some(
              (item) => getId(item) === getId(result.data),
            )
              ? previous
              : [...previous, result.data],
          )

          setConversations((previous) =>
            sortConversations(
              previous.map((conversation) =>
                getId(conversation) === conversationId
                  ? {
                      ...conversation,
                      lastMessage: result.data,
                      lastMessageText: getPreview(
                        result.data,
                      ).slice(0, 200),
                      lastMessageAt:
                        result.data.createdAt ||
                        new Date().toISOString(),
                      unreadCount: 0,
                    }
                  : conversation,
              ),
            ),
          )

          sentCount += 1
        }
      } catch (uploadError) {
        failedCount += 1

        setError(
          `${file.name}: ${uploadError.message || 'Upload failed.'}`,
        )
      }
    }

    if (sentCount) {
      setNotice(
        sentCount === 1
          ? 'Attachment sent.'
          : `${sentCount} attachments sent.`,
      )
    } else if (failedCount) {
      setNotice('')
    }

    setUploading(false)
  }

  async function toggleVoiceRecording() {
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }

    if (!activeId || uploading) return

    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        throw new Error(
          'Voice recording is not supported by this browser.',
        )
      }

      const conversationId = activeId

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      recordingStreamRef.current = stream

      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type))

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorderRef.current = recorder

      const chunks = []

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())

        recordingStreamRef.current = null
        recorderRef.current = null

        const type = recorder.mimeType || 'audio/webm'

        const extension = type.includes('ogg')
          ? 'ogg'
          : type.includes('mp4')
            ? 'm4a'
            : 'webm'

        const blob = new Blob(chunks, { type })

        if (!blob.size) return

        const file = new File(
          [blob],
          `voice-message-${Date.now()}.${extension}`,
          { type },
        )

        setUploading(true)

        try {
          const result = await uploadConversationFile(
            conversationId,
            file,
          )

          if (result.data) {
            setMessages((previous) =>
              previous.some(
                (item) => getId(item) === getId(result.data),
              )
                ? previous
                : [...previous, result.data],
            )

            setConversations((previous) =>
              sortConversations(
                previous.map((conversation) =>
                  getId(conversation) === conversationId
                    ? {
                        ...conversation,
                        lastMessage: result.data,
                        lastMessageText: 'Voice message',
                        lastMessageAt:
                          result.data.createdAt ||
                          new Date().toISOString(),
                      }
                    : conversation,
                ),
              ),
            )

            setNotice('Voice message sent.')
          }
        } catch (uploadError) {
          setError(
            uploadError.message ||
              'Could not send the voice note.',
          )
        } finally {
          setUploading(false)
        }
      }

      recorder.start()
      setRecording(true)

      setNotice(
        'Recording voice message. Press the microphone button again to stop.',
      )
    } catch (recordError) {
      setError(
        recordError.message ||
          'Microphone access is not available.',
      )

      recordingStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop())

      recordingStreamRef.current = null
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault()

    setWorking(true)
    setError('')

    try {
      const result = await updateProfile(profileName)

      setProfileUser((previous) => ({
        ...previous,
        ...result.user,
      }))

      setConversations((previous) =>
        previous.map((conversation) => ({
          ...conversation,
          participants: (conversation.participants || []).map(
            (person) =>
              getId(person) === currentUserId
                ? {
                    ...person,
                    displayName: result.user.displayName,
                    avatarUrl: result.user.avatarUrl,
                  }
                : person,
          ),
        })),
      )

      setShowProfile(false)
      setNotice('Profile updated.')
    } catch (profileError) {
      setError(
        profileError.message || 'Could not update your profile.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function handleAvatarSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Choose an image for your profile picture.')
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setError('Profile pictures must be 5 MB or smaller.')
      return
    }

    setWorking(true)
    setError('')

    try {
      const result = await uploadAvatar(file)

      setProfileUser((previous) => ({
        ...previous,
        ...result.user,
      }))

      setNotice('Profile picture updated.')
    } catch (avatarError) {
      setError(
        avatarError.message || 'Could not update your profile picture.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      setNotice('This browser does not support notifications.')
      return
    }

    try {
      const permission = await Notification.requestPermission()

      setNotice(
        permission === 'granted'
          ? 'Notifications enabled.'
          : 'Notifications were not enabled in browser settings.',
      )
    } catch {
      setError('Could not request notification permission.')
    }
  }

  async function startCall(mode) {
    if (
      !activeConversation ||
      !activeOtherUser ||
      activeConversation.isGroup
    ) {
      setError(
        'Voice and video calls are available in direct conversations only.',
      )
      return
    }

    if (callRef.current || incomingCallRef.current) {
      setError('Finish the current call before starting another one.')
      return
    }

    const callId = makeCallId()

    const peerName =
      activeOtherUser.displayName ||
      activeOtherUser.userId ||
      'ChatWave user'

    publishCall({
      callId,
      conversationId: activeId,
      mode,
      role: 'caller',
      phase: 'calling',
      peerName,
    })

    setError('')
    setNotice('Calling…')

    connectSocket().emit('call:invite', {
      callId,
      conversationId: activeId,
      mode,
    })
  }

  async function acceptIncomingCall() {
    const incoming = incomingCallRef.current

    if (!incoming) return

    setError('')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'This browser cannot access the microphone or camera.',
        )
      }

      const mode = incoming.mode === 'video' ? 'video' : 'audio'

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video',
      })

      if (incomingCallRef.current?.callId !== incoming.callId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      localStreamRef.current = stream
      setLocalStream(stream)

      const peerName =
        incoming.caller?.displayName ||
        incoming.caller?.userId ||
        'ChatWave user'

      publishCall({
        callId: incoming.callId,
        conversationId: incoming.conversationId,
        mode,
        role: 'callee',
        phase: 'connecting',
        peerName,
      })

      setIncomingCall(null)
      incomingCallRef.current = null

      makePeerConnection(incoming.callId, stream)

      getSocket().emit('call:accept', {
        callId: incoming.callId,
      })

      setLoadingMessages(true)
      setActiveId(incoming.conversationId)
    } catch (callError) {
      getSocket().emit('call:reject', {
        callId: incoming.callId,
        reason: 'media-error',
      })

      resetCall()

      setError(
        callError.message ||
          'Could not access the microphone or camera. Check browser permissions.',
      )
    }
  }

  function rejectIncomingCall() {
    const incoming = incomingCallRef.current

    if (incoming) {
      getSocket().emit('call:reject', {
        callId: incoming.callId,
        reason: 'rejected',
      })
    }

    incomingCallRef.current = null
    setIncomingCall(null)
  }

  function endCall() {
    const active = callRef.current

    if (active) {
      getSocket().emit('call:end', {
        callId: active.callId,
      })
    }

    resetCall()
    setNotice('Call ended.')
  }

  function toggleMute() {
    const nextMuted = !muted

    for (const track of localStreamRef.current?.getAudioTracks() || []) {
      track.enabled = !nextMuted
    }

    setMuted(nextMuted)
  }

  function toggleCamera() {
    const nextOff = !cameraOff

    for (const track of localStreamRef.current?.getVideoTracks() || []) {
      track.enabled = !nextOff
    }

    setCameraOff(nextOff)
  }

  async function handleSignOut() {
    if (working) return

    setWorking(true)

    try {
      if (callRef.current) {
        getSocket().emit('call:end', {
          callId: callRef.current.callId,
        })
      }

      disconnectSocket()
      resetCall()

      await onLogout()
    } catch (logoutError) {
      setError(
        logoutError.message || 'Sign-out failed. Try again.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="messenger-shell feature-messenger-shell">
      <aside
        className={`messenger-sidebar ${activeId ? 'has-active' : ''}`}
      >
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
          <span className="conversation-count">
            {conversations.length}
          </span>
        </div>

        {showNewChat && (
          <form
            className="new-chat-form"
            onSubmit={handleCreateConversation}
          >
            <label htmlFor="new-chat-identity">
              Start a conversation
            </label>

            <div className="new-chat-fields">
              <input
                id="new-chat-identity"
                type="text"
                value={newIdentity}
                onChange={(event) => setNewIdentity(event.target.value)}
                placeholder="User ID or email address"
                maxLength={254}
                autoComplete="off"
                required
              />

              <button type="submit" disabled={working}>
                {working ? '…' : 'Start'}
              </button>
            </div>

            <small>
              Enter the other person&apos;s exact ChatWave user ID or
              registered email.
            </small>
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

              const other = (conversation.participants || []).find(
                (person) => getId(person) !== currentUserId,
              )

              const name = getConversationName(
                conversation,
                currentUserId,
              )

              const selected = id === activeId

              const online =
                presence[getId(other)]?.online ??
                Boolean(other?.isOnline)

              return (
                <button
                  className={`conversation-item ${selected ? 'selected' : ''}`}
                  type="button"
                  key={id}
                  onClick={() => {
                    setConversations((previous) =>
                      previous.map((item) =>
                        getId(item) === id
                          ? { ...item, unreadCount: 0 }
                          : item,
                      ),
                    )

                    setLoadingMessages(true)
                    setActiveId(id)
                    setError('')
                    setNotice('')
                  }}
                >
                  <span className="feature-avatar-wrap">
                    <Avatar user={other} name={name} />
                    <i
                      className={`feature-presence-dot ${online ? 'online' : ''}`}
                    />
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

                  {Number(conversation.unreadCount) > 0 && (
                    <span className="feature-unread-badge">
                      {conversation.unreadCount > 99
                        ? '99+'
                        : conversation.unreadCount}
                    </span>
                  )}
                </button>
              )
            })
          ) : (
            <div className="messenger-empty small-empty">
              <span className="empty-icon">
                <Icon name="message" size={22} />
              </span>

              <strong>
                {search.trim()
                  ? 'No matches found'
                  : 'No conversations yet'}
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

        <div className="current-user-card feature-current-user">
          <Avatar
            user={profileUser}
            name={profileUser?.displayName}
            className="self-avatar"
          />

          <button
            type="button"
            className="feature-profile-open"
            onClick={() => {
              setProfileName(profileUser?.displayName || '')
              setShowProfile(true)
            }}
          >
            <strong>
              {profileUser?.displayName || 'ChatWave user'}
            </strong>
            <small>
              @{profileUser?.userId || 'user'} · Edit profile
            </small>
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={requestNotifications}
            title="Enable browser notifications"
            aria-label="Enable browser notifications"
          >
            <Icon name="bell" size={17} />
          </button>

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
                onClick={() => {
                  setMessages([])
                  setLoadingMessages(false)
                  setActiveId('')
                }}
                aria-label="Back to conversations"
              >
                <Icon name="back" />
              </button>

              <span className="feature-avatar-wrap">
                <Avatar
                  user={activeOtherUser}
                  name={activeName}
                  className="header-avatar"
                />
                <i
                  className={`feature-presence-dot ${activePresence?.online ? 'online' : ''}`}
                />
              </span>

              <div className="chat-header-info">
                <h2>{activeName}</h2>
                <p>
                  {activeConversation.isGroup
                    ? `${activeConversation.participants?.length || 0} participants`
                    : activePresence?.online
                      ? 'Online now'
                      : getLastSeen(
                          activePresence?.lastSeenAt ||
                            activeOtherUser?.lastSeenAt,
                        )}
                </p>
              </div>

              <div className="chat-header-actions feature-header-actions">
                {!activeConversation.isGroup && (
                  <>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => startCall('audio')}
                      disabled={Boolean(callState || incomingCall)}
                      aria-label="Start voice call"
                      title="Voice call"
                    >
                      <Icon name="phone" size={18} />
                    </button>

                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => startCall('video')}
                      disabled={Boolean(callState || incomingCall)}
                      aria-label="Start video call"
                      title="Video call"
                    >
                      <Icon name="video" size={18} />
                    </button>
                  </>
                )}

                <button
                  className="icon-button"
                  type="button"
                  onClick={handleClearHistory}
                  disabled={working}
                  aria-label="Clear history"
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
                    const messageType = message.type || 'text'

                    const mine =
                      getId(message.sender) === currentUserId

                    const readByOther = (message.readBy || []).some(
                      (reader) => getId(reader) !== currentUserId,
                    )

                    const deliveredToOther = (
                      message.deliveredTo || []
                    ).some(
                      (reader) => getId(reader) !== currentUserId,
                    )

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

                          {messageType === 'image' &&
                          message.attachment ? (
                            <div className="message-bubble feature-attachment-bubble">
                              <RemoteBlob
                                fileRef={getId(
                                  message.attachment.fileId,
                                )}
                                kind="image"
                                name={message.attachment.name}
                              />
                            </div>
                          ) : messageType === 'audio' &&
                            message.attachment ? (
                            <div className="message-bubble feature-attachment-bubble">
                              <span className="feature-attachment-label">
                                Voice message
                              </span>
                              <RemoteBlob
                                fileRef={getId(
                                  message.attachment.fileId,
                                )}
                                kind="audio"
                                name={message.attachment.name}
                              />
                            </div>
                          ) : messageType === 'file' &&
                            message.attachment ? (
                            <div className="message-bubble feature-attachment-bubble">
                              <span className="feature-attachment-label">
                                <Icon name="paperclip" size={16} />
                                {message.attachment.name}
                              </span>
                              <RemoteBlob
                                fileRef={getId(
                                  message.attachment.fileId,
                                )}
                                kind="file"
                                name={message.attachment.name}
                              />
                            </div>
                          ) : (
                            <div className="message-bubble">
                              {message.text}
                            </div>
                          )}

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
                            <div className="message-actions">
                              {messageType === 'text' && (
                                <button
                                  type="button"
                                  onClick={() => handleEditMessage(message)}
                                  aria-label="Edit message"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(message)}
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

            <form
              className="message-composer feature-composer"
              onSubmit={handleSendMessage}
            >
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

              <input
                ref={fileInputRef}
                className="feature-hidden-input"
                type="file"
                multiple
                accept={FILE_ACCEPT}
                onChange={handleFilesSelected}
              />

              <div className="composer-footer">
                <span>
                  {recording
                    ? 'Recording voice note… select the microphone again to stop'
                    : uploading
                      ? 'Uploading attachment…'
                      : 'Enter to send · Shift + Enter for a new line'}
                </span>

                <div className="feature-composer-actions">
                  <button
                    className="icon-button feature-attach-button"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || recording}
                    aria-label="Attach images or documents"
                    title="Attach images or documents (max 35 MB each)"
                  >
                    <Icon name="paperclip" size={18} />
                  </button>

                  <button
                    className={`icon-button feature-mic-button ${recording ? 'recording' : ''}`}
                    type="button"
                    onClick={toggleVoiceRecording}
                    disabled={uploading}
                    aria-label={
                      recording
                        ? 'Stop voice recording'
                        : 'Record voice message'
                    }
                    title={
                      recording ? 'Stop recording' : 'Record voice message'
                    }
                  >
                    <Icon name="mic" size={18} />
                  </button>

                  <button
                    className="send-message-button"
                    type="submit"
                    disabled={
                      sending ||
                      uploading ||
                      recording ||
                      !draft.trim()
                    }
                    aria-label="Send message"
                  >
                    <span>{sending ? 'Sending…' : 'Send'}</span>
                    <Icon name="send" size={17} />
                  </button>
                </div>
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
              Choose a conversation from the sidebar or start a new one
              using another person&apos;s ChatWave user ID or email address.
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

      {showProfile && (
        <div
          className="feature-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowProfile(false)
            }
          }}
        >
          <section
            className="feature-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
          >
            <button
              type="button"
              className="feature-modal-close"
              onClick={() => setShowProfile(false)}
              aria-label="Close profile editor"
            >
              ×
            </button>

            <h2 id="profile-title">Edit your profile</h2>
            <p>Your user ID and email address cannot be changed here.</p>

            <div className="feature-profile-avatar">
              <Avatar
                user={profileUser}
                name={profileUser?.displayName}
              />

              <div>
                <strong>{profileUser?.displayName}</strong>
                <small>@{profileUser?.userId}</small>

                <button
                  type="button"
                  className="text-link"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={working}
                >
                  Change picture (max 5 MB)
                </button>

                <input
                  ref={avatarInputRef}
                  className="feature-hidden-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/*"
                  onChange={handleAvatarSelected}
                />
              </div>
            </div>

            <form onSubmit={handleProfileSave}>
              <label
                className="feature-field-label"
                htmlFor="profile-display-name"
              >
                Display name
              </label>

              <input
                className="feature-profile-input"
                id="profile-display-name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                minLength={2}
                maxLength={50}
                required
              />

              <button
                className="primary-action feature-modal-submit"
                type="submit"
                disabled={working}
              >
                {working ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          </section>
        </div>
      )}

      {incomingCall && !callState && (
        <div className="feature-call-backdrop">
          <section
            className="feature-incoming-call"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-call-title"
          >
            <Avatar
              user={incomingCall.caller}
              name={incomingCall.caller?.displayName}
              className="feature-call-avatar"
            />

            <h2 id="incoming-call-title">
              Incoming {incomingCall.mode === 'video' ? 'video' : 'voice'} call
            </h2>

            <p>
              {incomingCall.caller?.displayName ||
                incomingCall.caller?.userId ||
                'A ChatWave user'}{' '}
              is calling.
            </p>

            <div className="feature-call-buttons">
              <button
                type="button"
                className="feature-call-accept"
                onClick={acceptIncomingCall}
              >
                <Icon name="phone" size={17} />
                Accept
              </button>

              <button
                type="button"
                className="feature-call-end"
                onClick={rejectIncomingCall}
              >
                <Icon name="close" size={17} />
                Decline
              </button>
            </div>
          </section>
        </div>
      )}

      {callState && (
        <div className="feature-call-backdrop">
          <section
            className={`feature-call-window ${callState.mode === 'video' ? 'video-call' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-call-title"
          >
            <header>
              <div>
                <h2 id="active-call-title">{callState.peerName}</h2>
                <p>
                  {callState.phase === 'calling'
                    ? 'Calling…'
                    : callState.phase === 'connected'
                      ? 'Connected'
                      : 'Connecting call…'}
                </p>
              </div>

              <button
                type="button"
                className="feature-modal-close"
                onClick={endCall}
                aria-label="End call"
              >
                ×
              </button>
            </header>

            {callState.mode === 'video' ? (
              <div className="feature-video-stage">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="feature-remote-video"
                />

                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="feature-local-video"
                />

                <p className="feature-video-wait">
                  {remoteStream
                    ? ''
                    : 'Waiting for the other person to connect…'}
                </p>
              </div>
            ) : (
              <div className="feature-audio-stage">
                <Avatar
                  user={activeOtherUser}
                  name={callState.peerName}
                  className="feature-call-avatar"
                />
                <audio ref={remoteAudioRef} autoPlay />
              </div>
            )}

            <div className="feature-call-controls">
              <button
                type="button"
                className={muted ? 'active' : ''}
                onClick={toggleMute}
                disabled={!localStream}
              >
                <Icon name="mute" size={18} />
                {muted ? 'Unmute' : 'Mute'}
              </button>

              {callState.mode === 'video' && (
                <button
                  type="button"
                  className={cameraOff ? 'active' : ''}
                  onClick={toggleCamera}
                  disabled={!localStream}
                >
                  <Icon name="camera" size={18} />
                  {cameraOff ? 'Camera on' : 'Camera off'}
                </button>
              )}

              <button
                type="button"
                className="feature-call-end"
                onClick={endCall}
              >
                <Icon name="close" size={18} />
                End call
              </button>
            </div>

            <p className="feature-call-network-note">
              Calls use peer-to-peer WebRTC. Some networks require a TURN
              relay service to connect.
            </p>
          </section>
        </div>
      )}
    </main>
  )
}