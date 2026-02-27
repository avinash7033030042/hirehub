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
if (!fs.existsSync(resumeDir)) {
    fs.mkdirSync(resumeDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, resumeDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || ".pdf")
        cb(null, `resume-${Date.now()}${ext}`)
    }
})
const upload = multer({ storage })

router.post("/register",async(req,res)=>{
    try{
        const {name,password,role}=req.body
        const email = req.body?.email?.trim()?.toLowerCase()
        if(!name || !email || !password || !role){
            return res.status(400).json({msg:"All fields are required"})
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

router.post("/upload-resume", auth, upload.single("resume"), async (req, res) => {
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

router.post("/seed-quick-accounts", async (req, res) => {
    try {
        const quickAccounts = [
            {
                name: "Recruiter Starter",
                email: "recruiter@hirehub.quick",
                password: "Recruiter@123",
                role: "recruiter"
            },
            {
                name: "Jobseeker Starter",
                email: "jobseeker@hirehub.quick",
                password: "Jobseeker@123",
                role: "jobseeker"
            }
        ]

        for (const account of quickAccounts) {
            const existing = await User.findOne({ email: account.email })
            if (!existing) {
                const hash = await bcrypt.hash(account.password, 10)
                await User.create({
                    name: account.name,
                    email: account.email,
                    password: hash,
                    role: account.role
                })
            }
        }

        res.json({
            msg: "Quick accounts ready",
            accounts: quickAccounts.map(({ email, password, role }) => ({ email, password, role }))
        })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to seed quick accounts" })
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
            return res.json({ msg: "If account exists, reset link sent" })
        }

        const token = crypto.randomBytes(20).toString("hex")
        user.resetToken = token
        user.resetTokenExpire = Date.now() + 3600000
        await user.save()
        const resetLink = await sendEmail(user.email, token)
        const response = { msg: "If account exists, reset link sent" }
        if (process.env.NODE_ENV !== "production") {
            response.resetLink = resetLink
        }
        res.json(response)
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to process forgot password" })
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
