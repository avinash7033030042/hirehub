const mongoose = require("mongoose")

const applicationSchema = new mongoose.Schema({
    job:{type:mongoose.Schema.Types.ObjectId,ref:"Job"},
    applicant:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    status:{type:String,default:"Applied"}
},{timestamps:true})

module.exports = mongoose.model("Application",applicationSchema)