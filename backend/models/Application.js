const mongoose = require("mongoose")

const applicationSchema = new mongoose.Schema({
    job:{type:mongoose.Schema.Types.ObjectId,ref:"Job"},
    applicant:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    applicantDetails:{
        name:String,
        email:String,
        phone:String,
        location:String,
        headline:String,
        bio:String,
        company:String,
        website:String,
        skills:String,
        resume:String,
        profileImage:String,
        role:String
    },
    status:{type:String,default:"Applied"}
},{timestamps:true})

module.exports = mongoose.model("Application",applicationSchema)
