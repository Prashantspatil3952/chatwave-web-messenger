const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '')

export function getFileUrl(fileId) {
  const id = String(fileId || '').replace(/^\/api\/files\//, '')
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '')

  return `${apiOrigin}/api/files/${encodeURIComponent(id)}`
}

export async function apiRequest(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const { headers: suppliedHeaders, body, ...requestOptions } = options
  const headers = new Headers(suppliedHeaders || {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const hasBody = body !== undefined && body !== null
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob

  if (
    hasBody &&
    !isFormData &&
    !isBlob &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...requestOptions,
    body,
    credentials: 'include',
    headers,
  })

  const contentType = response.headers.get('content-type') || ''
  let data

  if (contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && data.message
        ? data.message
        : typeof data === 'string' && data
          ? data
          : `Request failed with status ${response.status}`

    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export default apiRequest