const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '')

export async function apiRequest(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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

    throw new Error(message)
  }

  return data
}

export default apiRequest