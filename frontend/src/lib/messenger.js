import { apiRequest } from './api.js'

export async function getConversations() {
  return apiRequest('/conversations')
}

export async function createConversation(identity) {
  return apiRequest('/conversations', {
    method: 'POST',
    body: JSON.stringify({ identity }),
  })
}

export async function getMessages(conversationId, options = {}) {
  const { limit = 40, before } = options
  const params = new URLSearchParams()

  params.set('limit', String(limit))
  if (before) params.set('before', before)

  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
  )
}

export async function sendMessage(conversationId, text) {
  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    },
  )
}

export async function editMessage(conversationId, messageId, text) {
  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    },
  )
}

export async function deleteMessage(conversationId, messageId) {
  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  )
}

export async function closeConversation(conversationId) {
  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/close`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    },
  )
}

export async function clearConversationHistory(conversationId) {
  return apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/clear-history`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    },
  )
}

export async function uploadConversationFile(conversationId, file) {
  return apiRequest(
    `/files/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    },
  )
}

export async function updateProfile(displayName) {
  return apiRequest('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  })
}

export async function uploadAvatar(file) {
  return apiRequest('/files/avatar', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  })
}