export async function sendOtpEmail(email, otp, purpose = 'registration') {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || 'ChatWave Security'

  if (!apiKey) {
    throw new Error('BREVO_API_KEY is missing from backend/.env')
  }

  if (!senderEmail) {
    throw new Error('BREVO_SENDER_EMAIL is missing from backend/.env')
  }

  if (!email || !otp) {
    throw new Error('Recipient email and OTP are required.')
  }

  if (!['registration', 'password-reset'].includes(purpose)) {
    throw new Error('Invalid OTP email purpose.')
  }

  const subject =
    purpose === 'password-reset'
      ? 'Reset your ChatWave password'
      : 'Verify your ChatWave account'

  const safeOtp = String(otp).replace(/[^0-9]/g, '')

  const textContent =
    `Your ChatWave verification code is ${safeOtp}. ` +
    'It expires in 5 minutes. Never share this code with anyone.'

  const htmlContent = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:32px;background:#f5f5fb;font-family:Arial,sans-serif;color:#202033">
        <div style="max-width:460px;margin:0 auto;padding:32px;background:#ffffff;border-radius:16px">
          <h2 style="margin-top:0">ChatWave verification</h2>
          <p>Use this verification code to continue:</p>
          <div style="padding:18px;text-align:center;background:#f1f0ff;border-radius:12px">
            <strong style="font-size:30px;letter-spacing:7px">${safeOtp}</strong>
          </div>
          <p>This code expires in 5 minutes.</p>
          <p style="font-size:13px;color:#777789">
            Never share this code. If you did not request it, you can ignore this email.
          </p>
        </div>
      </body>
    </html>
  `

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email }],
      subject,
      textContent,
      htmlContent,
    }),
  })

  if (!response.ok) {
    // Log the status only; don't log API keys or OTP values.
    console.error('Brevo email request failed with status:', response.status)
    throw new Error(
      `Brevo could not accept the email request (HTTP ${response.status}).`,
    )
  }

  return response.json()
}