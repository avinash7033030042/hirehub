const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, ".env") })
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const fs = require("fs")

const app = express()
const uploadsDir = path.join(__dirname, "uploads")
const frontendDir = path.join(__dirname, "..", "frontend")
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

app.use(cors())
app.use(express.json())
app.use("/uploads", express.static(uploadsDir))

app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/jobs", require("./routes/jobRoutes"))
app.use("/api/applications", require("./routes/applicationRoutes"))
app.use("/api/notifications", require("./routes/notificationRoutes"))
app.use(express.static(frontendDir))

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDir, "login.html"))
})

app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendDir, "login.html"))
})

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({ msg: "Invalid JSON request body" })
    }
    next(err)
})

const PORT = process.env.PORT || 5000

async function startServer() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not set")
        }

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000
        })
        console.log(" MongoDB Atlas Connected Successfully")

        app.listen(PORT, () => {
            console.log(` Server running on port ${PORT}`)
        })
    } catch (err) {
        console.error(" MongoDB Connection Error:", err.message)
        process.exit(1)
    }
}

startServer()
