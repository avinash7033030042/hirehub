const express = require("express")
const router = express.Router()
const auth = require("../middleware/authMiddleware")
const Notification = require("../models/Notification")

router.get("/", auth, async (req, res) => {
    try {
        const notifications = await Notification
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
        res.json(notifications)
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to fetch notifications" })
    }
})

router.patch("/:id/read", auth, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isRead: true },
            { new: true }
        )
        if (!notification) return res.status(404).json({ msg: "Notification not found" })
        res.json(notification)
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to update notification" })
    }
})

router.patch("/read-all", auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, isRead: false },
            { $set: { isRead: true } }
        )
        res.json({ msg: "All notifications marked as read" })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to mark all as read" })
    }
})

module.exports = router
