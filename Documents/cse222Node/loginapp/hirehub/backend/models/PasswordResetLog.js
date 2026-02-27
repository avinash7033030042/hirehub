const mongoose = require("mongoose")

const passwordResetLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true },
    method: { type: String, enum: ["direct", "token"], required: true }
}, { timestamps: true })

module.exports = mongoose.model("PasswordResetLog", passwordResetLogSchema)
