import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    purpose: {
      type: String,
      required: true,
      enum: ['registration', 'password-reset'],
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// Automatically remove old OTP records after 30 days.
// Expiration of an OTP is checked separately using expiresAt.
otpSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
)

const Otp =
  mongoose.models.Otp || mongoose.model('Otp', otpSchema)

export default Otp