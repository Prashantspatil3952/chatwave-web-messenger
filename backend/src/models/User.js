import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    userId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 4,
      maxlength: 30,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    avatarUrl: {
      type: String,
      default: '',
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User