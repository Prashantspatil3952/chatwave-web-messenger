import { Router } from 'express'
import {
  createConversation,
  listConversations,
} from '../controllers/conversation.controller.js'
import {
  clearConversationHistory,
  closeConversation,
} from '../controllers/conversationSettings.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/', listConversations)
router.post('/', createConversation)
router.patch('/:conversationId/close', closeConversation)
router.patch('/:conversationId/clear-history', clearConversationHistory)

export default router