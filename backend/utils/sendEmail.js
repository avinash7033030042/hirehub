const nodemailer = require("nodemailer")
const https = require("https")

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

function sendWithResend(mail) {
    const apiKey = cleanEnv(process.env.RESEND_API_KEY)
    if (!apiKey) return null

    const payload = JSON.stringify({
        from: cleanEnv(process.env.RESEND_FROM) || "Hire Hub <onboarding@resend.dev>",
        to: Array.isArray(mail.to) ? mail.to : [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html
    })

    const requestOptions = {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
        },
        timeout: 20000
    }

    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            let body = ""
            res.on("data", (chunk) => {
                body += chunk
            })
            res.on("end", () => {
                let data = {}
                try {
                    data = body ? JSON.parse(body) : {}
                } catch {
                    data = { message: body }
                }

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data)
                    return
                }

                reject(new Error(data.message || data.error || `Resend API failed with status ${res.statusCode}`))
            })
        })

        req.on("timeout", () => {
            req.destroy(new Error("Resend API request timeout"))
        })
        req.on("error", reject)
        req.write(payload)
        req.end()
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
    const resendResult = sendWithResend(mail)
    if (resendResult) {
        try {
            return await resendResult
        } catch (err) {
            console.error("Email send failed with Resend:", err.message)
            return { failed: true, provider: "resend", error: err.message }
        }
    }

    const transporter = createTransporter()

    if (!transporter) {
        console.error("Email not sent: set RESEND_API_KEY for Render free, or SMTP_USER/SMTP_PASS for SMTP.")
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
