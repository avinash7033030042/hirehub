const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    type: { type: String, default: "info" },
    message: String,
    link: String,
    isRead: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model("Notification", notificationSchema)
