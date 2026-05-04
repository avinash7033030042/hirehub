const express=require("express")
const router=express.Router()
const Application=require("../models/Application")
const Job = require("../models/Job")
const User = require("../models/User")
const Notification = require("../models/Notification")
const sendEmail = require("../utils/sendEmail")
const auth=require("../middleware/authMiddleware")

router.post("/apply/:jobId",auth,async(req,res)=>{
    try{
        const user = await User.findById(req.user.id)
        if(!user) return res.status(404).json({ msg: "User not found" })
        if(user.role !== "jobseeker"){
            return res.status(403).json({ msg: "Only job seeker can apply" })
        }

        const job = await Job.findById(req.params.jobId)
        if(!job) return res.status(404).json({ msg: "Job not found" })

        const existing = await Application.findOne({
            job: req.params.jobId,
            applicant: req.user.id
        })
        if(existing){
            return res.status(400).json({ msg: "Already applied to this job" })
        }

        const app=await Application.create({
            job:req.params.jobId,
            applicant:req.user.id,
            applicantDetails: {
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || "",
                location: user.location || "",
                headline: user.headline || "",
                bio: user.bio || "",
                company: user.company || "",
                website: user.website || "",
                skills: user.skills || "",
                resume: user.resume || "",
                profileImage: user.profileImage || "",
                role: user.role || "jobseeker"
            }
        })

        await Notification.create({
            user: req.user.id,
            type: "application",
            message: `Applied to ${job.title} at ${job.company}`,
            link: "/dashboard.html"
        })
        await sendEmail({
            to: user.email,
            subject: "Hire Hub application submitted",
            text: `You applied to ${job.title} at ${job.company}.`,
            html: `
                <h2>Application submitted</h2>
                <p>You applied to <strong>${job.title}</strong> at <strong>${job.company}</strong>.</p>
                <p>Your saved profile details and resume were attached to this application record for the recruiter.</p>
            `
        })

        if(job.recruiter){
            const recruiter = await User.findById(job.recruiter)
            await Notification.create({
                user: job.recruiter,
                type: "application",
                message: `${user.name} applied for ${job.title}`,
                link: "/dashboard.html"
            })
            if (recruiter?.email) {
                await sendEmail({
                    to: recruiter.email,
                    subject: `New applicant for ${job.title}`,
                    text: `${user.name} applied for ${job.title}. Email: ${user.email}. Phone: ${user.phone || "Not provided"}.`,
                    html: `
                        <h2>New job application</h2>
                        <p><strong>${user.name}</strong> applied for <strong>${job.title}</strong>.</p>
                        <p>Email: ${user.email}</p>
                        <p>Phone: ${user.phone || "Not provided"}</p>
                        <p>Location: ${user.location || "Not provided"}</p>
                        <p>Open Hire Hub Applications to view full details and resume.</p>
                    `
                })
            }
        }

        res.json(app)
    }catch(err){
        res.status(500).json({ msg: err.message || "Application failed" })
    }
})

router.get("/my-applications",auth,async(req,res)=>{
    try{
        const apps=await Application.find({applicant:req.user.id}).populate("job")
            .sort({ createdAt: -1 })
        res.json(apps)
    }catch(err){
        res.status(500).json({ msg: err.message || "Failed to fetch applications" })
    }
})

router.get("/received", auth, async (req, res) => {
    try{
        const user = await User.findById(req.user.id)
        if(!user) return res.status(404).json({ msg: "User not found" })
        if(user.role !== "recruiter"){
            return res.status(403).json({ msg: "Only recruiter can view received applications" })
        }

        const jobs = await Job.find({ recruiter: req.user.id }).select("_id")
        const jobIds = jobs.map((j) => j._id)
        const apps = await Application.find({ job: { $in: jobIds } })
            .populate("job")
            .populate("applicant", "name email phone location headline bio company website skills resume profileImage")
            .sort({ createdAt: -1 })
        res.json(apps)
    }catch(err){
        res.status(500).json({ msg: err.message || "Failed to fetch recruiter applications" })
    }
})

module.exports=router
