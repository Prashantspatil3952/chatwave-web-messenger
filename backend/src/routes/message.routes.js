import { Router } from 'express'
import {
  listMessages,
  sendMessage,
} from '../controllers/message.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router({ mergeParams: true })

router.use(requireAuth)

router.get('/', listMessages)
router.post('/', sendMessage)

export default router