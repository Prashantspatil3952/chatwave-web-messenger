import { apiRequest } from './api.js'

export async function getConversations() {
  return apiRequest('/conversations')
}

export async function createConversation(userId) {
  return apiRequest('/conversations', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export async function getMessages(conversationId, options = {}) {
  const { limit = 40, before } = options
  const params = new URLSearchParams()

  params.set('limit', String(limit))

  if (before) {
    params.set('before', before)
  }

  const id = encodeURIComponent(conversationId)

  return apiRequest(`/conversations/${id}/messages?${params.toString()}`)
}

export async function sendMessage(conversationId, text) {
  const id = encodeURIComponent(conversationId)

  return apiRequest(`/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function editMessage(conversationId, messageId, text) {
  const conversation = encodeURIComponent(conversationId)
  const message = encodeURIComponent(messageId)

  return apiRequest(
    `/conversations/${conversation}/messages/${message}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    },
  )
}

export async function deleteMessage(conversationId, messageId) {
  const conversation = encodeURIComponent(conversationId)
  const message = encodeURIComponent(messageId)

  return apiRequest(
    `/conversations/${conversation}/messages/${message}`,
    {
      method: 'DELETE',
    },
  )
}

export async function closeConversation(conversationId) {
  const id = encodeURIComponent(conversationId)

  return apiRequest(`/conversations/${id}/close`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}

export async function clearConversationHistory(conversationId) {
  const id = encodeURIComponent(conversationId)

  return apiRequest(`/conversations/${id}/clear-history`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}