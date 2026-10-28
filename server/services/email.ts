import nodemailer from 'nodemailer'
import { config } from '../config.js'

export const sendEmail = async (input: { to: string; subject: string; html: string }) => {
  if (config.EMAIL_PREVIEW_MODE === 'true' || !config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD) {
    console.info('[email-preview]', JSON.stringify(input))
    return { status: 'PREVIEW' as const }
  }
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
  })
  await transporter.sendMail({ from: config.SMTP_FROM ?? config.SMTP_USER, ...input })
  return { status: 'SENT' as const }
}
