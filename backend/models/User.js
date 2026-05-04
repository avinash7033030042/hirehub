const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name:String,
    email:{type:String,unique:true},
    password:String,
    role:{type:String,enum:["recruiter","jobseeker"]},
    resume:String,
    profileImage:String,
    phone:String,
    location:String,
    headline:String,
    bio:String,
    company:String,
    website:String,
    skills:String,
    resetToken:String,
    resetTokenExpire:Date,
    resetOtp:String,
    resetOtpExpire:Date
},{timestamps:true})

module.exports = mongoose.model("User",userSchema)
