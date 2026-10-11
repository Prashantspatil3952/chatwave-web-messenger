import { io } from 'socket.io-client'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

let socket = null

/**
 * Create or return the shared Socket.IO client.
 * The socket connects only when connectSocket() is called.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
  }

  return socket
}

/**
 * Connect to the backend Socket.IO server.
 */
export function connectSocket() {
  const client = getSocket()

  if (!client.connected) {
    client.connect()
  }

  return client
}

/**
 * Disconnect the shared socket connection.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
  }
}

/**
 * Check whether the socket is currently connected.
 */
export function isSocketConnected() {
  return Boolean(socket?.connected)
}

export default getSocket