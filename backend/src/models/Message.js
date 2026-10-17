import mongoose from 'mongoose'

const attachmentSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: { type: String, required: true, maxlength: 180 },
    mimeType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true, min: 1 },
  },
  { _id: false },
)

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio'],
      default: 'text',
      required: true,
    },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    attachment: { type: attachmentSchema, default: null },
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

messageSchema.pre('validate', function validateMessage() {
  if (this.type === 'text' && !this.text?.trim()) {
    this.invalidate('text', 'Message text cannot be empty.')
  }

  if (this.type !== 'text' && !this.attachment?.fileId) {
    this.invalidate(
      'attachment',
      'An attachment is required for this message.',
    )
  }
})

messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 })
messageSchema.index({
  conversation: 1,
  deletedAt: 1,
  createdAt: -1,
  _id: -1,
})
messageSchema.index({ conversation: 1, sender: 1, deletedAt: 1 })
messageSchema.index({
  conversation: 1,
  sender: 1,
  readBy: 1,
  deletedAt: 1,
})

const Message =
  mongoose.models.Message || mongoose.model('Message', messageSchema)

export default Message