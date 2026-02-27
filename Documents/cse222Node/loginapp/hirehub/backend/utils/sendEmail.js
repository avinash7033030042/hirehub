const sendEmail = async (email, token) => {
    const appUrl = process.env.APP_URL || "http://localhost:8080"
    const resetLink = `${appUrl}/reset.html?token=${token}`
    console.log("Password reset for:", email)
    console.log("Reset Link:", resetLink)
    return resetLink
}

module.exports = sendEmail
