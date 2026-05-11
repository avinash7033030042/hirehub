const nodemailer = require("nodemailer")

function cleanEnv(value) {
    return String(value || "").trim()
}

function createTransporter() {
    const host = cleanEnv(process.env.SMTP_HOST) || "smtp.gmail.com"
    const port = Number(process.env.SMTP_PORT || 587)
    const user = cleanEnv(process.env.SMTP_USER || process.env.EMAIL_USER)
    const pass = cleanEnv(process.env.SMTP_PASS || process.env.EMAIL_PASS).replace(/\s+/g, "")

    if (!user || !pass) return null

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user, pass },
        tls: { servername: host }
    })
}

async function sendEmail(toOrOptions, token) {
    const appUrl = cleanEnv(process.env.APP_URL) || "http://localhost:8080"
    const from = cleanEnv(process.env.MAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER) || "Hire Hub <no-reply@hirehub.local>"
    const options = typeof toOrOptions === "string"
        ? {
            to: toOrOptions,
            subject: "Reset your Hire Hub password",
            text: `Reset your Hire Hub password: ${appUrl}/reset.html?token=${token}`,
            html: `<p>Reset your Hire Hub password:</p><p><a href="${appUrl}/reset.html?token=${token}">Reset Password</a></p>`
        }
        : toOrOptions

    const mail = { from, ...options }
    const transporter = createTransporter()

    if (!transporter) {
        console.error("Email not sent: SMTP_USER/SMTP_PASS are missing. Set them in backend/.env locally or Render environment variables in production.")
        return { skipped: true }
    }

    try {
        return await transporter.sendMail(mail)
    } catch (err) {
        console.error("Email send failed:", err.message, err.code || "")
        return { failed: true, error: err.message }
    }
}

module.exports = sendEmail
