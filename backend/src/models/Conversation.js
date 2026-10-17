import mongoose from 'mongoose'

const conversationUserSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hidden: { type: Boolean, default: false },
    clearedAt: { type: Date, default: null },
  },
  { _id: false },
)

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      ],
      required: true,
      validate: {
        validator(participants) {
          return (
            participants.length >= 2 &&
            participants.length <= 100 &&
            new Set(participants.map(String)).size === participants.length
          )
        },
        message: 'A conversation needs distinct participants.',
      },
    },
    isGroup: { type: Boolean, default: false },
    title: { type: String, trim: true, maxlength: 80, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    directKey: { type: String, trim: true },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageText: { type: String, maxlength: 200, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    userSettings: { type: [conversationUserSettingsSchema], default: [] },
  },
  { timestamps: true },
)

conversationSchema.index({ participants: 1, lastMessageAt: -1 })
conversationSchema.index({ lastMessageAt: -1 })
conversationSchema.index({ participants: 1, isGroup: 1 })
conversationSchema.index(
  { directKey: 1 },
  {
    unique: true,
    sparse: true,
    name: 'unique_direct_conversation_key',
  },
)

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', conversationSchema)

export default Conversation