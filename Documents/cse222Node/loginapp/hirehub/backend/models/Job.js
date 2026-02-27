const mongoose = require("mongoose")

const jobSchema = new mongoose.Schema({
    title:String,
    company:String,
    location:String,
    salary:String,
    description:String,
    recruiter:{type:mongoose.Schema.Types.ObjectId,ref:"User"}
},{timestamps:true})

module.exports = mongoose.model("Job",jobSchema)