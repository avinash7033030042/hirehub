const nodemailer = require("nodemailer")

function createTransporter() {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 587)
    const user = process.env.SMTP_USER || process.env.EMAIL_USER
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS

    if (!user || !pass) return null

    return nodemailer.createTransport({
        host: host || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: { user, pass }
    })
}

async function sendEmail(toOrOptions, token) {
    const appUrl = process.env.APP_URL || "http://localhost:8080"
    const from = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || "Hire Hub <no-reply@hirehub.local>"
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
        console.error("Email not sent: SMTP credentials are missing in backend/.env")
        return { skipped: true }
    }

    try {
        return await transporter.sendMail(mail)
    } catch (err) {
        console.error("Email send failed:", err.message)
        return { failed: true, error: err.message }
    }
}

module.exports = sendEmail
