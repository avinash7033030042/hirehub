const API = window.location.port === "3000" ? "/api" : "http://localhost:3000/api"
let isPostingJob = false

function getToken() {
    return localStorage.getItem("token") || ""
}

function getRole() {
    return localStorage.getItem("role") || ""
}

function ensureRole(requiredRole) {
    const currentRole = getRole()
    if (!currentRole) {
        alert("⚠️ Please login first")
        window.location.href = "login.html"
        return false
    }
    if (currentRole === requiredRole) return true

    const currentLabel = currentRole === "recruiter" ? "Recruiter" : "Job Seeker"
    const requiredLabel = requiredRole === "recruiter" ? "Recruiter" : "Job Seeker"
    alert(`⚠️ You are logged in as ${currentLabel}. Please use ${requiredLabel} account.`)
    return false
}

async function safeJson(res) {
    return res.json().catch(() => ({}))
}

function setAuth(token, user) {
    localStorage.setItem("token", token)
    localStorage.setItem("role", user.role)
    localStorage.setItem("name", user.name || "")
    localStorage.setItem("userId", user._id || "")
}

async function register() {
    const name = document.getElementById("name")?.value?.trim()
    const email = document.getElementById("email")?.value?.trim()?.toLowerCase()
    const password = document.getElementById("password")?.value
    const role = document.getElementById("role")?.value

    if (!name || !email || !password || !role) {
        alert("⚠️ All fields required")
        return
    }

    const res = await fetch(API + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
    })
    const data = await safeJson(res)
    if (res.ok) {
        alert("✅ Registered successfully. Please login.")
        window.location.href = "login.html"
    } else {
        alert(data.msg || "❌ Registration failed")
    }
}

async function login() {
    const email = document.getElementById("email")?.value?.trim()?.toLowerCase()
    const password = document.getElementById("password")?.value
    const role = document.getElementById("role")?.value || ""

    if (!email || !password) {
        alert("⚠️ Enter email and password")
        return
    }

    const res = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    })
    const data = await safeJson(res)

    if (res.ok && data.token && data.user) {
        setAuth(data.token, data.user)
        window.location.href = "dashboard.html"
    } else {
        alert(data.msg || "❌ Login failed")
    }
}

async function useQuick(role) {
    await fetch(API + "/auth/seed-quick-accounts", { method: "POST" })
    const creds = role === "recruiter"
        ? { email: "recruiter@hirehub.quick", password: "Recruiter@123" }
        : { email: "jobseeker@hirehub.quick", password: "Jobseeker@123" }

    const res = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...creds, role })
    })
    const data = await safeJson(res)
    if (res.ok && data.token && data.user) {
        setAuth(data.token, data.user)
        window.location.href = "dashboard.html"
    } else {
        alert(data.msg || "❌ Quick login failed")
    }
}

function logout() {
    localStorage.removeItem("token")
    localStorage.removeItem("role")
    localStorage.removeItem("name")
    localStorage.removeItem("userId")
    window.location.href = "login.html"
}

function checkAuth() {
    if (!getToken()) window.location.href = "login.html"
}

async function fetchProfile() {
    const res = await fetch(API + "/auth/me", {
        headers: { Authorization: getToken() }
    })
    return safeJson(res)
}

async function uploadResume() {
    if (!ensureRole("jobseeker")) return
    const input = document.getElementById("resumeFile")
    const file = input?.files?.[0]
    if (!file) {
        alert("⚠️ Select a resume file first")
        return
    }

    const formData = new FormData()
    formData.append("resume", file)

    const res = await fetch(API + "/auth/upload-resume", {
        method: "POST",
        headers: { Authorization: getToken() },
        body: formData
    })
    const data = await safeJson(res)
    if (res.ok) {
        alert("✅ Resume uploaded")
        updateProfileUI(data.user)
    } else {
        alert(data.msg || "❌ Resume upload failed")
    }
}

function updateProfileUI(user) {
    const nameEl = document.getElementById("welcomeName")
    const roleEl = document.getElementById("roleBadge")
    const resumeEl = document.getElementById("resumeLink")

    if (nameEl) nameEl.textContent = user?.name || localStorage.getItem("name") || "User"
    if (roleEl) roleEl.textContent = user?.role || localStorage.getItem("role") || "jobseeker"

    if (resumeEl) {
        if (user?.resume) {
            resumeEl.href = user.resume
            resumeEl.textContent = "View Uploaded Resume"
            resumeEl.style.display = "inline-flex"
        } else {
            resumeEl.style.display = "none"
        }
    }
}

function parseSalary(text) {
    if (!text) return 0
    const clean = String(text).toLowerCase()
    const numMatch = clean.match(/\d+(\.\d+)?/)
    if (!numMatch) return 0
    const n = Number(numMatch[0])
    if (clean.includes("lpa")) return n * 100000
    if (clean.includes("k")) return n * 1000
    return n
}

async function loadJobs() {
    await runJobSearch()
}

async function runJobSearch() {
    try {
        const title = document.getElementById("searchTitle")?.value?.trim() || ""
        const location = document.getElementById("searchLocation")?.value?.trim() || ""
        const company = document.getElementById("searchCompany")?.value?.trim() || ""
        const minSalary = document.getElementById("minSalary")?.value?.trim() || ""

        const params = new URLSearchParams({
            title,
            location,
            company,
            minSalary
        })

        const res = await fetch(API + `/jobs/all?${params.toString()}`)
        const jobs = await safeJson(res)
        displayJobs(Array.isArray(jobs) ? jobs : [])
    } catch {
        alert("❌ Unable to load jobs")
    }
}

async function searchJobs() {
    await runJobSearch()
}

async function clearSearch(event) {
    if (event) event.preventDefault()
    const ids = ["searchTitle", "searchLocation", "searchCompany", "minSalary"]
    ids.forEach((id) => {
        const el = document.getElementById(id)
        if (el) el.value = ""
    })
    await loadJobs()
}

function displayJobs(jobs) {
    const container = document.getElementById("jobs")
    if (!container) return
    container.innerHTML = ""
    const role = localStorage.getItem("role")
    const userId = localStorage.getItem("userId") || ""

    if (!jobs.length) {
        container.innerHTML = "<p class=\"emptyState\">📭 No jobs found for this filter.</p>"
        return
    }

    jobs.forEach((job) => {
        const div = document.createElement("div")
        div.className = "jobCard"
        div.innerHTML = `
            <h3>${job.title || "Untitled Role"}</h3>
            <p><strong>Company:</strong> ${job.company || "Unknown"}</p>
            <p><strong>Location:</strong> ${job.location || "Not provided"}</p>
            <p><strong>Salary:</strong> ${job.salary || "Not disclosed"}</p>
            <p><strong>Description:</strong> ${job.description || "No description provided"}</p>
            ${role === "jobseeker" ? `<button type="button" class="applyBtn" onclick="applyJob('${job._id}')">Apply</button>` : ""}
            ${(role === "recruiter" && String(job.recruiter || "") === String(userId))
                ? `<button type="button" class="secondaryBtn miniBtn" onclick="deleteJob('${job._id}')">Delete</button>`
                : ""}
        `
        container.appendChild(div)
    })
}

async function deleteJob(jobId) {
    if (!ensureRole("recruiter")) return

    const ok = window.confirm("Delete this job post?")
    if (!ok) return

    const res = await fetch(API + "/jobs/" + jobId, {
        method: "DELETE",
        headers: {
            Authorization: getToken()
        }
    })
    const data = await safeJson(res)
    if (res.ok) {
        alert("✅ Job deleted")
        loadJobs()
        loadRecruiterApplications()
        loadNotifications()
    } else {
        alert(data.msg || "❌ Delete failed")
    }
}

async function applyJob(jobId) {
    if (!ensureRole("jobseeker")) return
    const token = getToken()
    if (!token) {
        alert("⚠️ Login required")
        return
    }

    const res = await fetch(API + "/applications/apply/" + jobId, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: token
        }
    })
    const data = await safeJson(res)
    if (res.ok) {
        alert("✅ Applied successfully")
        loadMyApplications()
        loadNotifications()
    } else {
        alert(data.msg || "❌ Application failed")
    }
}

async function loadMyApplications() {
    const wrap = document.getElementById("myApplications")
    if (!wrap) return
    if (!ensureRole("jobseeker")) {
        wrap.innerHTML = "<p class=\"emptyState\">🔒 Job seeker access only.</p>"
        return
    }
    const res = await fetch(API + "/applications/my-applications", {
        headers: { Authorization: getToken() }
    })
    const apps = await safeJson(res)
    if (!Array.isArray(apps) || apps.length === 0) {
        wrap.innerHTML = "<p class=\"emptyState\">📭 No applications yet.</p>"
        return
    }

    wrap.innerHTML = apps.map((app) => `
        <div class="miniCard">
            <p><strong>${app.job?.title || "Job removed"}</strong></p>
            <p>${app.job?.company || "-"}</p>
            <p>Status: ${app.status || "Applied"}</p>
        </div>
    `).join("")
}

async function loadRecruiterApplications() {
    const wrap = document.getElementById("recruiterApplications")
    if (!wrap) return
    if (!ensureRole("recruiter")) {
        wrap.innerHTML = "<p class=\"emptyState\">🔒 Recruiter access only.</p>"
        return
    }

    const res = await fetch(API + "/applications/received", {
        headers: { Authorization: getToken() }
    })
    const apps = await safeJson(res)
    if (!res.ok) {
        wrap.innerHTML = `<p class="emptyState">${apps.msg || "❌ Unable to load received applications."}</p>`
        return
    }
    if (!Array.isArray(apps) || apps.length === 0) {
        wrap.innerHTML = "<p class=\"emptyState\">📭 No applications received yet.</p>"
        return
    }

    wrap.innerHTML = apps.map((app) => `
        <div class="miniCard">
            <p><strong>${app.job?.title || "Job"}</strong> - ${app.job?.company || "-"}</p>
            <p>Applicant: ${app.applicant?.name || "Unknown"} (${app.applicant?.email || "-"})</p>
            <p>Status: ${app.status || "Applied"}</p>
            ${app.applicant?.resume ? `<a target="_blank" rel="noreferrer" href="${app.applicant.resume}">📄 View Resume</a>` : "<p>📭 No resume uploaded</p>"}
        </div>
    `).join("")
}

async function postJob() {
    if (isPostingJob) return
    if (!ensureRole("recruiter")) return

    const title = document.getElementById("jobTitle")?.value?.trim() || ""
    const company = document.getElementById("jobCompany")?.value?.trim() || ""
    const location = document.getElementById("jobLocation")?.value?.trim() || ""
    const salary = document.getElementById("jobSalary")?.value?.trim() || ""
    const description = document.getElementById("jobDescription")?.value?.trim() || ""

    if (!title || !company || !location || !description) {
        alert("⚠️ Title, company, location, description required")
        return
    }

    isPostingJob = true
    try {
        const res = await fetch(API + "/jobs/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: getToken()
            },
            body: JSON.stringify({ title, company, location, salary, description })
        })
        const data = await safeJson(res)

        if (res.ok) {
            alert("✅ Job posted")
            window.location.href = "dashboard.html"
        } else {
            alert(data.msg || "❌ Post job failed")
        }
    } finally {
        isPostingJob = false
    }
}

async function loadNotifications() {
    const container = document.getElementById("notifications")
    if (!container) return
    const res = await fetch(API + "/notifications", {
        headers: { Authorization: getToken() }
    })
    const list = await safeJson(res)
    if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = "<p class=\"emptyState\">🔔 No notifications yet.</p>"
        return
    }

    container.innerHTML = list.map((n) => `
        <div class="miniCard ${n.isRead ? "read" : "unread"}">
            <p>${n.message || "Notification"}</p>
            <div class="miniActions">
                ${n.link ? `<a href="${n.link}">Open</a>` : ""}
                ${n.isRead ? "" : `<button type="button" onclick="markNotificationRead('${n._id}')">Mark read</button>`}
            </div>
        </div>
    `).join("")
}

async function markNotificationRead(id) {
    await fetch(API + `/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: getToken() }
    })
    loadNotifications()
}

async function markAllRead() {
    await fetch(API + "/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: getToken() }
    })
    loadNotifications()
}

async function initDashboard() {
    checkAuth()
    const user = await fetchProfile()
    if (user?._id) {
        localStorage.setItem("userId", user._id)
    }
    updateProfileUI(user)

    const role = user?.role || localStorage.getItem("role")
    const recruiterOnly = document.querySelectorAll(".recruiterOnly")
    const seekerOnly = document.querySelectorAll(".seekerOnly")

    recruiterOnly.forEach((el) => {
        el.style.display = role === "recruiter" ? "" : "none"
    })
    seekerOnly.forEach((el) => {
        el.style.display = role === "jobseeker" ? "" : "none"
    })

    await Promise.all([loadJobs(), loadNotifications()])
    if (role === "jobseeker") {
        loadMyApplications()
    } else if (role === "recruiter") {
        loadRecruiterApplications()
    }
}

function refreshRecruiterData() {
    loadNotifications()
    loadRecruiterApplications()
}

if (typeof window !== "undefined") {
    window.register = register
    window.login = login
    window.useQuick = useQuick
    window.logout = logout
    window.checkAuth = checkAuth
    window.searchJobs = searchJobs
    window.clearSearch = clearSearch
    window.applyJob = applyJob
    window.deleteJob = deleteJob
    window.postJob = postJob
    window.uploadResume = uploadResume
    window.markNotificationRead = markNotificationRead
    window.markAllRead = markAllRead
    window.initDashboard = initDashboard
    window.refreshRecruiterData = refreshRecruiterData
}

document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("searchBtn")
    const clearBtn = document.getElementById("clearBtn")
    const logoutBtn = document.getElementById("logoutBtn")
    const postJobBtn = document.getElementById("postJobBtn")
    const resumeBtn = document.getElementById("resumeBtn")
    const markAllBtn = document.getElementById("markAllBtn")
    const refreshReceivedBtn = document.getElementById("refreshReceivedBtn")

    if (searchBtn) searchBtn.addEventListener("click", searchJobs)
    if (clearBtn) clearBtn.addEventListener("click", clearSearch)
    if (logoutBtn) logoutBtn.addEventListener("click", logout)
    if (postJobBtn) postJobBtn.addEventListener("click", postJob)
    if (resumeBtn) resumeBtn.addEventListener("click", uploadResume)
    if (markAllBtn) markAllBtn.addEventListener("click", markAllRead)
    if (refreshReceivedBtn) refreshReceivedBtn.addEventListener("click", refreshRecruiterData)

    if (postJobBtn && !ensureRole("recruiter")) {
        window.location.href = "dashboard.html"
    }

    const searchInputs = ["searchTitle", "searchLocation", "searchCompany", "minSalary"]
    searchInputs.forEach((id) => {
        const el = document.getElementById(id)
        if (el) {
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") searchJobs()
            })
        }
    })
})
