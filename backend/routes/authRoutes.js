const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const PasswordResetLog = require("../models/PasswordResetLog")
const crypto = require("crypto")
const path = require("path")
const fs = require("fs")
const multer = require("multer")
const sendEmail = require("../utils/sendEmail")
const auth = require("../middleware/authMiddleware")

const resumeDir = path.join(__dirname, "..", "uploads", "resumes")
const avatarDir = path.join(__dirname, "..", "uploads", "avatars")
if (!fs.existsSync(resumeDir)) {
    fs.mkdirSync(resumeDir, { recursive: true })
}
if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true })
}

const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, resumeDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || ".pdf")
        cb(null, `resume-${Date.now()}${ext}`)
    }
})
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || ".jpg")
        cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`)
    }
})
const uploadResume = multer({ storage: resumeStorage })
const uploadAvatar = multer({
    storage: avatarStorage,
    fileFilter: (req, file, cb) => {
        if (!file.mimetype?.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"))
        }
        cb(null, true)
    }
})

function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(password || ""))
}

router.post("/register",async(req,res)=>{
    try{
        const {name,password,role}=req.body
        const email = req.body?.email?.trim()?.toLowerCase()
        if(!name || !email || !password || !role){
            return res.status(400).json({msg:"All fields are required"})
        }
        if(!isStrongPassword(password)){
            return res.status(400).json({msg:"Password must be 8+ characters with uppercase, lowercase, number, and special character"})
        }

        const existingUser = await User.findOne({email})
        if(existingUser){
            return res.status(400).json({msg:"Email already registered"})
        }

        const hash=await bcrypt.hash(password,10)
        const user=await User.create({name,email,password:hash,role})
        res.json(user)
    }catch(err){
        res.status(500).json({msg: err.message || "Registration failed"})
    }
})

router.post("/login",async(req,res)=>{
    try{
        const email = req.body?.email?.trim()?.toLowerCase()
        const {password,role}=req.body
        if(!email || !password){
            return res.status(400).json({msg:"Email and password are required"})
        }

        const user=await User.findOne({email})
        if(!user) return res.status(400).json({msg:"No user found with this email"})
        const match=await bcrypt.compare(password,user.password)
        if(!match) return res.status(400).json({msg:"Wrong password"})
        if (role && role !== user.role) {
            return res.status(400).json({msg:`This account is ${user.role}. Please select correct role.`})
        }
        const token=jwt.sign({id:user._id,role:user.role},process.env.JWT_SECRET)
        res.json({token,user})
    }catch(err){
        res.status(500).json({msg: err.message || "Login failed"})
    }
})

router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -resetToken -resetTokenExpire")
        if (!user) return res.status(404).json({ msg: "User not found" })
        res.json(user)
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to fetch profile" })
    }
})

router.patch("/profile", auth, async (req, res) => {
    try {
        const allowedFields = ["name", "phone", "location", "headline", "bio", "company", "website", "skills"]
        const updates = {}

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = String(req.body[field]).trim()
            }
        })

        if (!updates.name) {
            return res.status(400).json({ msg: "Name is required" })
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true, runValidators: true }
        ).select("-password -resetToken -resetTokenExpire")

        if (!user) return res.status(404).json({ msg: "User not found" })
        res.json({ msg: "Profile updated", user })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Profile update failed" })
    }
})

router.post("/upload-avatar", auth, uploadAvatar.single("avatar"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: "Profile image required" })
        const profileImage = `/uploads/avatars/${req.file.filename}`
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { profileImage },
            { new: true }
        ).select("-password -resetToken -resetTokenExpire")
        res.json({ msg: "Profile image uploaded", user })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Profile image upload failed" })
    }
})

router.post("/upload-resume", auth, uploadResume.single("resume"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: "Resume file required" })
        const resumeUrl = `/uploads/resumes/${req.file.filename}`
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { resume: resumeUrl },
            { new: true }
        ).select("-password -resetToken -resetTokenExpire")
        res.json({ msg: "Resume uploaded", user })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Resume upload failed" })
    }
})

router.post("/forgot-password", async (req, res) => {
    try {
        const email = req.body?.email?.trim()?.toLowerCase()
        if (!email) {
            return res.status(400).json({ msg: "Email is required" })
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.json({ msg: "If account exists, OTP sent to email" })
        }

        const otp = String(crypto.randomInt(100000, 999999))
        user.resetOtp = await bcrypt.hash(otp, 10)
        user.resetOtpExpire = Date.now() + 10 * 60 * 1000
        await user.save()

        const emailResult = await sendEmail({
            to: user.email,
            subject: "Your Hire Hub password reset OTP",
            text: `Your Hire Hub OTP is ${otp}. It will expire in 10 minutes.`,
            html: `
                <h2>Hire Hub Password Reset</h2>
                <p>Your OTP is:</p>
                <h1 style="letter-spacing:6px">${otp}</h1>
                <p>This OTP will expire in 10 minutes.</p>
            `
        })
        if (emailResult?.skipped || emailResult?.failed) {
            return res.status(500).json({
                msg: "OTP email not sent. Configure Gmail SMTP in backend/.env and restart server."
            })
        }
        const response = { msg: "If account exists, OTP sent to email" }
        if (process.env.NODE_ENV !== "production") {
            response.otp = otp
        }
        res.json(response)
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to process forgot password" })
    }
})

router.post("/reset-password-otp", async (req, res) => {
    try {
        const email = req.body?.email?.trim()?.toLowerCase()
        const otp = String(req.body?.otp || "").trim()
        const password = req.body?.password
        const confirmPassword = req.body?.confirmPassword

        if (!email || !otp || !password || !confirmPassword) {
            return res.status(400).json({ msg: "Email, OTP, password, and confirm password are required" })
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                msg: "Password must be 8+ characters with uppercase, lowercase, number, and special character"
            })
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ msg: "Password and confirm password do not match" })
        }

        const user = await User.findOne({
            email,
            resetOtpExpire: { $gt: Date.now() }
        })
        if (!user || !user.resetOtp) {
            return res.status(400).json({ msg: "Invalid or expired OTP" })
        }

        const match = await bcrypt.compare(otp, user.resetOtp)
        if (!match) {
            return res.status(400).json({ msg: "Invalid or expired OTP" })
        }

        user.password = await bcrypt.hash(password, 10)
        user.resetOtp = null
        user.resetOtpExpire = null
        user.resetToken = null
        user.resetTokenExpire = null
        await user.save()
        await PasswordResetLog.create({
            user: user._id,
            email: user.email,
            method: "otp"
        })

        await sendEmail({
            to: user.email,
            subject: "Hire Hub password changed",
            text: "Your Hire Hub password was changed successfully.",
            html: "<p>Your Hire Hub password was changed successfully.</p>"
        })

        res.json({ msg: "Password updated successfully. Please login." })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to reset password" })
    }
})

router.post("/reset-password-direct", async (req, res) => {
    try {
        const email = req.body?.email?.trim()?.toLowerCase()
        const password = req.body?.password

        if (!email || !password) {
            return res.status(400).json({ msg: "Email and password are required" })
        }
        if (String(password).length < 6) {
            return res.status(400).json({ msg: "Password must be at least 6 characters" })
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({ msg: "No account found with this email" })
        }

        user.password = await bcrypt.hash(password, 10)
        user.resetToken = null
        user.resetTokenExpire = null
        user.resetOtp = null
        user.resetOtpExpire = null
        await user.save()
        await PasswordResetLog.create({
            user: user._id,
            email: user.email,
            method: "direct"
        })

        res.json({ msg: "Password updated successfully. Please login." })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to update password" })
    }
})

router.post("/reset-password/:token", async (req, res) => {
    try {
        const token = req.params.token
        const password = req.body?.password
        if (!password || String(password).length < 6) {
            return res.status(400).json({ msg: "Password must be at least 6 characters" })
        }

        const user = await User.findOne({
            resetToken: token,
            resetTokenExpire: { $gt: Date.now() }
        })
        if (!user) {
            return res.status(400).json({ msg: "Invalid or expired reset token" })
        }

        user.password = await bcrypt.hash(password, 10)
        user.resetToken = null
        user.resetTokenExpire = null
        await user.save()
        await PasswordResetLog.create({
            user: user._id,
            email: user.email,
            method: "token"
        })
        res.json({ msg: "Password reset" })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to reset password" })
    }
})

module.exports=router
