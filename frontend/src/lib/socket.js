import { io } from 'socket.io-client'

const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:5000'
).replace(/\/$/, '')

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 750,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 10000,
    })
  }

  return socket
}

export function connectSocket() {
  const client = getSocket()

  if (!client.connected && !client.active) {
    client.connect()
  }

  return client
}

export function disconnectSocket() {
  if (socket) socket.disconnect()
}

export function isSocketConnected() {
  return Boolean(socket?.connected)
}

export default getSocket