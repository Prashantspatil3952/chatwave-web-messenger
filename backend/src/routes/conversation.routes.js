import { Router } from 'express'
import {
  createConversation,
  listConversations,
} from '../controllers/conversation.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/', listConversations)
router.post('/', createConversation)

export default router