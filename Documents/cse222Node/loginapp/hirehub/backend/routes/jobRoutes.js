const express=require("express")
const router=express.Router()
const Job=require("../models/Job")
const Application = require("../models/Application")
const User = require("../models/User")
const Notification = require("../models/Notification")
const auth=require("../middleware/authMiddleware")

const LOCATION_ALIASES = {
    "andhra pradesh": ["ap", "visakhapatnam", "vijayawada", "guntur", "tirupati"],
    "arunachal pradesh": ["ar", "itanagar", "naharlagun", "pasighat"],
    "assam": ["as", "guwahati", "dibrugarh", "silchar", "jorhat"],
    "bihar": ["br", "patna", "gaya", "muzaffarpur", "bhagalpur"],
    "chhattisgarh": ["cg", "raipur", "bhilai", "bilaspur", "durg"],
    "goa": ["ga", "panaji", "margao", "vasco"],
    "gujarat": ["gj", "ahmedabad", "surat", "vadodara", "rajkot"],
    "haryana": ["hr", "gurgaon", "gurugram", "faridabad", "panipat"],
    "himachal pradesh": ["hp", "shimla", "dharamshala", "solan", "mandi"],
    "jharkhand": ["jh", "ranchi", "jamshedpur", "dhanbad", "bokaro"],
    "karnataka": ["ka", "bengaluru", "bangalore", "mysuru", "mangalore", "hubli"],
    "kerala": ["kl", "kochi", "thiruvananthapuram", "kozhikode", "thrissur"],
    "madhya pradesh": ["mp", "bhopal", "indore", "gwalior", "jabalpur"],
    "maharashtra": ["mh", "mumbai", "pune", "nagpur", "nashik", "thane"],
    "manipur": ["mn", "imphal", "churachandpur"],
    "meghalaya": ["ml", "shillong", "tura"],
    "mizoram": ["mz", "aizawl", "lunglei"],
    "nagaland": ["nl", "kohima", "dimapur"],
    "odisha": ["or", "od", "bhubaneswar", "cuttack", "rourkela"],
    "punjab": ["pb", "ludhiana", "amritsar", "jalandhar", "mohali", "chandigarh"],
    "rajasthan": ["rj", "jaipur", "kota", "udaipur", "jodhpur", "ajmer"],
    "sikkim": ["sk", "gangtok", "namchi"],
    "tamil nadu": ["tn", "chennai", "coimbatore", "madurai", "salem", "tiruchirappalli"],
    "telangana": ["ts", "hyderabad", "warangal", "khammam"],
    "tripura": ["tr", "agartala"],
    "uttar pradesh": ["up", "noida", "lucknow", "kanpur", "ghaziabad", "agra", "varanasi"],
    "uttarakhand": ["uk", "ut", "dehradun", "haridwar", "haldwani"],
    "west bengal": ["wb", "kolkata", "howrah", "durgapur", "siliguri"],
    "andaman and nicobar islands": ["an", "port blair"],
    "chandigarh": ["ch", "mohali", "panchkula"],
    "dadra and nagar haveli and daman and diu": ["dd", "daman", "diu", "silvassa"],
    "delhi": ["dl", "new delhi", "ncr", "gurgaon", "gurugram", "faridabad", "noida"],
    "jammu and kashmir": ["jk", "srinagar", "jammu", "anantnag"],
    "ladakh": ["la", "leh", "kargil"],
    "lakshadweep": ["ld", "kavaratti"],
    "puducherry": ["py", "pondicherry", "karaikal", "yanam"]
}

function escapeRegex(value){
    return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
}

function buildLocationTerms(locationInput){
    if(!locationInput) return []

    const input = locationInput.toLowerCase()
    const terms = new Set([input])

    Object.entries(LOCATION_ALIASES).forEach(([state, aliases]) => {
        if(state.includes(input) || aliases.some((alias) => alias.includes(input) || input.includes(alias))){
            terms.add(state)
            aliases.forEach((alias) => terms.add(alias))
        }
    })

    return [...terms]
}

function buildTokens(value){
    if(!value) return []
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
}

function parseSalaryValue(salaryText){
    if(!salaryText) return 0
    const text = String(salaryText).toLowerCase()
    const numMatch = text.match(/\d+(\.\d+)?/)
    if(!numMatch) return 0
    const num = Number(numMatch[0])
    if(Number.isNaN(num)) return 0
    if(text.includes("lpa")) return num * 100000
    if(text.includes("k")) return num * 1000
    return num
}

function countTokenMatches(text, tokens){
    if(!text || !tokens.length) return 0
    const lower = String(text).toLowerCase()
    return tokens.reduce((count, token) => (
        lower.includes(token) ? count + 1 : count
    ), 0)
}

router.post("/create",auth,async(req,res)=>{
    try{
        const user = await User.findById(req.user.id)
        if(!user) return res.status(404).json({ msg: "User not found" })
        if(user.role !== "recruiter"){
            return res.status(403).json({ msg: "Only recruiter can post jobs" })
        }

        const { title, company, location, description } = req.body
        if(!title || !company || !location || !description){
            return res.status(400).json({ msg: "Title, company, location, description required" })
        }

        const job=await Job.create({...req.body,recruiter:req.user.id})
        await Notification.create({
            user: req.user.id,
            type: "job",
            message: `Job posted: ${job.title} (${job.location})`,
            link: "/postjob.html"
        })
        res.json(job)
    }catch(err){
        res.status(500).json({ msg: err.message || "Job creation failed" })
    }
})

router.get("/all",async(req,res)=>{
    try{
        const title = (req.query.title || "").trim()
        const location = (req.query.location || "").trim()
        const company = (req.query.company || "").trim()
        const minSalary = Number(req.query.minSalary || 0)
        const titleTokens = buildTokens(title)
        const tokenSet = new Set([
            ...buildTokens(title),
            ...buildTokens(location),
            ...buildTokens(company)
        ])
        const tokens = [...tokenSet]

        const query = {}
        if(title){
            query.title = new RegExp(escapeRegex(title),"i")
        }
        if(company){
            query.company = new RegExp(escapeRegex(company),"i")
        }
        if(location){
            const terms = buildLocationTerms(location)
            if(terms.length > 0){
                query.$or = terms.map((term) => ({
                    location: new RegExp(escapeRegex(term),"i")
                }))
            }
        }

        const strictConditions = []
        if(query.title) strictConditions.push({ title: query.title })
        if(query.company) strictConditions.push({ company: query.company })
        if(query.$or) strictConditions.push({ $or: query.$or })

        let jobs = (title || location || company)
            ? await Job.find(strictConditions.length ? { $and: strictConditions } : {})
            : await Job.find({})

        // Keep title search focused, but tolerate typos in one token.
        if(jobs.length === 0 && titleTokens.length > 0){
            const titleOr = titleTokens.map((token) => ({
                title: new RegExp(escapeRegex(token),"i")
            }))
            const relaxedConditions = [{ $or: titleOr }]
            if(query.company) relaxedConditions.push({ company: query.company })
            if(query.$or) relaxedConditions.push({ $or: query.$or })
            jobs = await Job.find({ $and: relaxedConditions })
        }

        if(jobs.length === 0 && company && !title){
            jobs = await Job.find({ company: new RegExp(escapeRegex(company),"i") })
        }

        // Broad token fallback only when title is not provided.
        if(jobs.length === 0 && tokens.length > 0 && !title){
            const tokenOr = tokens.flatMap((token) => ([
                { title: new RegExp(escapeRegex(token),"i") },
                { location: new RegExp(escapeRegex(token),"i") },
                { company: new RegExp(escapeRegex(token),"i") },
                { description: new RegExp(escapeRegex(token),"i") }
            ]))
            jobs = await Job.find({ $or: tokenOr })
        }
        if(jobs.length === 0 && location && !title && !company){
            jobs = await Job.find({})
        }

        if(minSalary > 0){
            jobs = jobs.filter((job) => parseSalaryValue(job.salary) >= minSalary)
        }

        if(title){
            const titleLower = title.toLowerCase()
            jobs = jobs.sort((a,b) => {
                const aTitle = String(a.title || "").toLowerCase()
                const bTitle = String(b.title || "").toLowerCase()

                const scoreA =
                    (aTitle === titleLower ? 100 : 0) +
                    (aTitle.startsWith(titleLower) ? 30 : 0) +
                    (aTitle.includes(titleLower) ? 20 : 0) +
                    countTokenMatches(aTitle, titleTokens)

                const scoreB =
                    (bTitle === titleLower ? 100 : 0) +
                    (bTitle.startsWith(titleLower) ? 30 : 0) +
                    (bTitle.includes(titleLower) ? 20 : 0) +
                    countTokenMatches(bTitle, titleTokens)

                if(scoreB !== scoreA) return scoreB - scoreA
                return new Date(b.createdAt) - new Date(a.createdAt)
            })
        }

        res.json(jobs)
    }catch(err){
        res.status(500).json({msg: err.message || "Failed to fetch jobs"})
    }
})

router.delete("/:jobId", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ msg: "User not found" })
        if (user.role !== "recruiter") {
            return res.status(403).json({ msg: "Only recruiter can delete jobs" })
        }

        const job = await Job.findById(req.params.jobId)
        if (!job) return res.status(404).json({ msg: "Job not found" })
        if (!job.recruiter || String(job.recruiter) !== String(req.user.id)) {
            return res.status(403).json({ msg: "You can delete only your own jobs" })
        }

        await Application.deleteMany({ job: job._id })
        await Job.findByIdAndDelete(job._id)

        res.json({ msg: "Job deleted" })
    } catch (err) {
        res.status(500).json({ msg: err.message || "Failed to delete job" })
    }
})

module.exports=router
