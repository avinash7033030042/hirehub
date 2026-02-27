const express=require("express")
const router=express.Router()
const Application=require("../models/Application")
const Job = require("../models/Job")
const User = require("../models/User")
const Notification = require("../models/Notification")
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
        if(!job.recruiter){
            return res.status(400).json({ msg: "This job has no recruiter owner. Apply to recruiter-posted jobs only." })
        }

        const existing = await Application.findOne({
            job: req.params.jobId,
            applicant: req.user.id
        })
        if(existing){
            return res.status(400).json({ msg: "Already applied to this job" })
        }

        const app=await Application.create({
            job:req.params.jobId,
            applicant:req.user.id
        })

        await Notification.create({
            user: req.user.id,
            type: "application",
            message: `Applied to ${job.title} at ${job.company}`,
            link: "/dashboard.html"
        })

        if(job.recruiter){
            await Notification.create({
                user: job.recruiter,
                type: "application",
                message: `${user.name} applied for ${job.title}`,
                link: "/dashboard.html"
            })
        }

        res.json(app)
    }catch(err){
        res.status(500).json({ msg: err.message || "Application failed" })
    }
})

router.get("/my-applications",auth,async(req,res)=>{
    try{
        const apps=await Application.find({applicant:req.user.id}).populate("job")
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
            .populate("applicant", "name email resume")
            .sort({ createdAt: -1 })
        res.json(apps)
    }catch(err){
        res.status(500).json({ msg: err.message || "Failed to fetch recruiter applications" })
    }
})

module.exports=router
