const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name:String,
    email:{type:String,unique:true},
    password:String,
    role:{type:String,enum:["recruiter","jobseeker"]},
    resume:String,
    resetToken:String,
    resetTokenExpire:Date
},{timestamps:true})

module.exports = mongoose.model("User",userSchema)