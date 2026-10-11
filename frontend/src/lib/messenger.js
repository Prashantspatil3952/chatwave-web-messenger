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
  const { limit = 50, before } = options
  const params = new URLSearchParams()

  params.set('limit', String(limit))

  if (before) {
    params.set('before', before)
  }

  const id = encodeURIComponent(conversationId)

  return apiRequest(
    `/conversations/${id}/messages?${params.toString()}`,
  )
}

export async function sendMessage(conversationId, text) {
  const id = encodeURIComponent(conversationId)

  return apiRequest(`/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}