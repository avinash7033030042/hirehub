const hostname = typeof window !== "undefined" ? window.location.hostname : ""
const isLocalFrontend = !hostname || ["localhost", "127.0.0.1", "::1"].includes(hostname)
const API = isLocalFrontend ? "http://localhost:3000/api" : "/api"

let currentUserCache = null
let isPostingJob = false

function getToken() {
    return localStorage.getItem("token") || ""
}

function getRole() {
    return localStorage.getItem("role") || ""
}

function formatRoleLabel(role) {
    return role === "recruiter" ? "Recruiter" : "Job Seeker"
}

function setTextContent(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
}

function setHtml(id, value) {
    const el = document.getElementById(id)
    if (el) el.innerHTML = value
}

function getAssetUrl(path) {
    if (!path) return ""
    if (/^https?:\/\//i.test(path)) return path
    return isLocalFrontend ? `http://localhost:3000${path}` : path
}

function getPageKey() {
    return document.body?.dataset?.page || ""
}

function getUserInitials(name) {
    const parts = String(name || "Hire Hub")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)

    return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "HH"
}

function clearAuth() {
    localStorage.removeItem("token")
    localStorage.removeItem("role")
    localStorage.removeItem("name")
    localStorage.removeItem("userId")
}

function checkAuth() {
    if (!getToken()) {
        window.location.href = "login.html"
        return false
    }
    return true
}

function safeJson(res) {
    return res.json().catch(() => ({}))
}

function setAuth(token, user) {
    localStorage.setItem("token", token)
    localStorage.setItem("role", user.role)
    localStorage.setItem("name", user.name || "")
    localStorage.setItem("userId", user._id || "")
}

function togglePassword(inputId, trigger) {
    const input = document.getElementById(inputId)
    if (!input) return

    const showPassword = input.type === "password"
    input.type = showPassword ? "text" : "password"
    if (trigger) {
        trigger.classList.toggle("isVisible", showPassword)
        trigger.setAttribute("aria-label", showPassword ? "Hide password" : "Show password")
    }
}

function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(password || ""))
}

function updatePasswordStrength(inputId = "password", labelId = "passwordStrength") {
    const input = document.getElementById(inputId)
    const label = document.getElementById(labelId)
    if (!input || !label) return

    if (!input.value) {
        label.textContent = "Use 8+ chars with uppercase, lowercase, number, and special character."
        label.className = "passwordStrength"
        return
    }

    if (isStrongPassword(input.value)) {
        label.textContent = "Strong password"
        label.className = "passwordStrength strong"
    } else {
        label.textContent = "Weak password: add uppercase, lowercase, number, special character, and use 8+ chars."
        label.className = "passwordStrength weak"
    }
}

function logout() {
    clearAuth()
    window.location.href = "login.html"
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function formatDate(value) {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    })
}

function applyRoleVisibility(role) {
    document.querySelectorAll(".recruiterOnly").forEach((el) => {
        el.style.display = role === "recruiter" ? "" : "none"
    })

    document.querySelectorAll(".seekerOnly").forEach((el) => {
        el.style.display = role === "jobseeker" ? "" : "none"
    })
}

function highlightActiveNav(page) {
    document.querySelectorAll(".portalNavLink").forEach((link) => {
        if (link.dataset.nav === page) {
            link.classList.add("active")
        } else {
            link.classList.remove("active")
        }
    })
}

function populateSharedShell(user, activePage) {
    const role = user?.role || getRole() || "jobseeker"
    const name = user?.name || localStorage.getItem("name") || "User"
    const roleLabel = formatRoleLabel(role)

    setTextContent("sidebarUserName", name)
    setTextContent("sidebarUserRole", roleLabel)
    setTextContent("sidebarUserInitials", getUserInitials(name))
    setTextContent("roleBadge", roleLabel)
    setTextContent(
        "portalDate",
        new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric"
        })
    )

    applyRoleVisibility(role)
    highlightActiveNav(activePage)

    const avatar = document.getElementById("sidebarUserInitials")
    if (avatar) {
        const imageUrl = getAssetUrl(user?.profileImage)
        avatar.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : ""
        avatar.style.backgroundSize = imageUrl ? "cover" : ""
        avatar.style.backgroundPosition = imageUrl ? "center" : ""
        avatar.textContent = imageUrl ? "" : getUserInitials(name)
    }
}

async function register() {
    const name = document.getElementById("name")?.value?.trim()
    const email = document.getElementById("email")?.value?.trim()?.toLowerCase()
    const password = document.getElementById("password")?.value
    const role = document.getElementById("role")?.value

    if (!name || !email || !password || !role) {
        alert("All fields are required")
        return
    }
    if (!isStrongPassword(password)) {
        alert("Use a strong password: 8+ chars, uppercase, lowercase, number, and special character.")
        return
    }

    const res = await fetch(API + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
    })
    const data = await safeJson(res)

    if (res.ok) {
        alert("Registered successfully. Please login.")
        window.location.href = "login.html"
    } else {
        alert(data.msg || "Registration failed")
    }
}

async function login() {
    const email = document.getElementById("email")?.value?.trim()?.toLowerCase()
    const password = document.getElementById("password")?.value
    const role = document.getElementById("role")?.value || ""

    if (!email || !password) {
        alert("Enter email and password")
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
        currentUserCache = data.user
        window.location.href = "dashboard.html"
    } else {
        alert(data.msg || "Login failed")
    }
}

async function fetchProfile() {
    const res = await fetch(API + "/auth/me", {
        headers: { Authorization: getToken() }
    })

    const data = await safeJson(res)
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            clearAuth()
            window.location.href = "login.html"
        }
        throw new Error(data.msg || "Failed to fetch profile")
    }
    return data
}

async function getCurrentUser(force = false) {
    if (!checkAuth()) return null
    if (!force && currentUserCache?._id) return currentUserCache

    const user = await fetchProfile()
    currentUserCache = user
    if (user?._id) {
        localStorage.setItem("userId", user._id)
        localStorage.setItem("name", user.name || "")
        localStorage.setItem("role", user.role || "")
    }
    return user
}

async function fetchJobs(filters = {}) {
    const params = new URLSearchParams({
        title: filters.title || "",
        location: filters.location || "",
        company: filters.company || "",
        minSalary: filters.minSalary || ""
    })

    const res = await fetch(API + `/jobs/all?${params.toString()}`)
    const data = await safeJson(res)
    return Array.isArray(data) ? data : []
}

async function fetchNotifications() {
    const res = await fetch(API + "/notifications", {
        headers: { Authorization: getToken() }
    })
    const data = await safeJson(res)
    return Array.isArray(data) ? data : []
}

async function fetchMyApplications() {
    const res = await fetch(API + "/applications/my-applications", {
        headers: { Authorization: getToken() }
    })
    const data = await safeJson(res)
    return Array.isArray(data) ? data : []
}

async function fetchReceivedApplications() {
    const res = await fetch(API + "/applications/received", {
        headers: { Authorization: getToken() }
    })
    const data = await safeJson(res)
    return Array.isArray(data) ? data : []
}

function renderJobs(containerId, jobs, options = {}) {
    const container = document.getElementById(containerId)
    if (!container) return

    const limit = options.limit || jobs.length
    const visibleJobs = jobs.slice(0, limit)
    const role = getRole()
    const userId = localStorage.getItem("userId") || ""

    if (!visibleJobs.length) {
        container.innerHTML = `<p class="emptyState">${options.emptyMessage || "No jobs available right now."}</p>`
        return
    }

    container.innerHTML = visibleJobs.map((job) => `
        <article class="jobCard">
            <div class="jobCardHeader">
                <div class="jobTitleBlock">
                    <h3>${escapeHtml(job.title || "Untitled Role")}</h3>
                    <p class="jobCompanyLine">${escapeHtml(job.company || "Unknown Company")}</p>
                </div>
                <span class="jobSalaryTag">${escapeHtml(job.salary || "Not disclosed")}</span>
            </div>
            <div class="jobMetaRow">
                <span class="jobMetaItem">${escapeHtml(job.location || "Location not provided")}</span>
                <span class="jobMetaItem">${formatDate(job.createdAt)}</span>
            </div>
            <p class="jobDescription">${escapeHtml(job.description || "No description provided")}</p>
            <div class="jobActions">
                ${role === "jobseeker" ? `<button type="button" class="applyBtn" onclick="applyJob('${job._id}')">Apply</button>` : ""}
                ${(role === "recruiter" && String(job.recruiter || "") === String(userId))
                    ? `<button type="button" class="secondaryBtn miniBtn" onclick="deleteJob('${job._id}')">Delete</button>`
                    : ""}
            </div>
        </article>
    `).join("")
}

function renderNotifications(containerId, notifications, options = {}) {
    const container = document.getElementById(containerId)
    if (!container) return

    const limit = options.limit || notifications.length
    const visibleItems = notifications.slice(0, limit)

    if (!visibleItems.length) {
        container.innerHTML = `<p class="emptyState">${options.emptyMessage || "No notifications yet."}</p>`
        return
    }

    container.innerHTML = visibleItems.map((item) => `
        <article class="miniCard ${item.isRead ? "read" : "unread"}">
            <p>${escapeHtml(item.message || "Notification")}</p>
            <div class="listMetaRow">
                <span>${formatDate(item.createdAt)}</span>
                ${item.isRead ? "<span>Read</span>" : "<span>Unread</span>"}
            </div>
            <div class="miniActions">
                ${item.link ? `<a href="${escapeHtml(item.link)}">Open</a>` : ""}
                ${item.isRead ? "" : `<button type="button" onclick="markNotificationRead('${item._id}')">Mark read</button>`}
            </div>
        </article>
    `).join("")
}

function renderJobseekerApplications(containerId, applications, options = {}) {
    const container = document.getElementById(containerId)
    if (!container) return

    const limit = options.limit || applications.length
    const visibleItems = applications.slice(0, limit)

    if (!visibleItems.length) {
        container.innerHTML = `<p class="emptyState">${options.emptyMessage || "No applications yet."}</p>`
        return
    }

    container.innerHTML = visibleItems.map((app) => `
        <article class="miniCard">
            <p><strong>${escapeHtml(app.job?.title || "Job removed")}</strong></p>
            <p>${escapeHtml(app.job?.company || "-")}</p>
            <div class="listMetaRow">
                <span>${escapeHtml(app.status || "Applied")}</span>
                <span>${formatDate(app.createdAt)}</span>
            </div>
        </article>
    `).join("")
}

function renderRecruiterApplications(containerId, applications, options = {}) {
    const container = document.getElementById(containerId)
    if (!container) return

    const limit = options.limit || applications.length
    const visibleItems = applications.slice(0, limit)

    if (!visibleItems.length) {
        container.innerHTML = `<p class="emptyState">${options.emptyMessage || "No applications received yet."}</p>`
        return
    }

    container.innerHTML = visibleItems.map((app) => {
        const details = {
            ...(app.applicant || {}),
            ...(app.applicantDetails || {})
        }
        const name = details.name || "Unknown Candidate"
        const imageUrl = getAssetUrl(details.profileImage)
        const resumeUrl = getAssetUrl(details.resume)
        const websiteUrl = details.website || ""
        const skills = String(details.skills || "")
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean)

        return `
            <article class="miniCard applicantCard">
                <div class="applicantCardHead">
                    <div class="applicantAvatar" style="${imageUrl ? `background-image:url('${escapeHtml(imageUrl)}')` : ""}">${imageUrl ? "" : escapeHtml(getUserInitials(name))}</div>
                    <div>
                        <p><strong>${escapeHtml(name)}</strong></p>
                        <p>${escapeHtml(details.headline || "Job seeker")}</p>
                        <div class="listMetaRow">
                            <span>${escapeHtml(details.email || "-")}</span>
                            <span>${escapeHtml(details.phone || "No phone")}</span>
                        </div>
                    </div>
                </div>

                <div class="applicationJobBox">
                    <span>Applied for</span>
                    <strong>${escapeHtml(app.job?.title || "Job")}</strong>
                    <p>${escapeHtml(app.job?.company || "-")} · ${escapeHtml(app.job?.location || "Location not provided")}</p>
                </div>

                <div class="applicantDetailGrid">
                    <div><span>Location</span><strong>${escapeHtml(details.location || "-")}</strong></div>
                    <div><span>Company / College</span><strong>${escapeHtml(details.company || "-")}</strong></div>
                    <div><span>Status</span><strong>${escapeHtml(app.status || "Applied")}</strong></div>
                    <div><span>Applied</span><strong>${formatDate(app.createdAt)}</strong></div>
                </div>

                <p class="profileLongText">${escapeHtml(details.bio || "No profile summary added by this candidate.")}</p>
                <div class="skillPillRow">
                    ${skills.length ? skills.map((skill) => `<span class="skillPill">${escapeHtml(skill)}</span>`).join("") : "<span class=\"skillPill mutedSkill\">No skills added</span>"}
                </div>

                <div class="miniActions">
                    ${resumeUrl ? `<a target="_blank" rel="noreferrer" href="${escapeHtml(resumeUrl)}">View Resume</a>` : ""}
                    ${websiteUrl ? `<a target="_blank" rel="noreferrer" href="${escapeHtml(websiteUrl)}">Open Website</a>` : ""}
                    ${details.email ? `<a href="mailto:${escapeHtml(details.email)}">Email Candidate</a>` : ""}
                </div>
            </article>
        `
    }).join("")
}

function updateOverviewStats(user, jobs, notifications, applications) {
    const unreadCount = notifications.filter((item) => !item.isRead).length
    const role = user?.role || getRole()
    const resumeStatus = role === "recruiter" ? "Live" : (user?.resume ? "Ready" : "Pending")
    const isRecruiter = role === "recruiter"

    setTextContent("statJobsCount", jobs.length)
    setTextContent("statApplicationsCount", applications.length)
    setTextContent("statNotificationsCount", unreadCount)
    setTextContent("statResumeStatus", resumeStatus)
    setTextContent("statJobsMeta", isRecruiter ? "Posted" : "Open")
    setTextContent("statApplicationsMeta", isRecruiter ? "Received" : "Applied")
    setTextContent("statNotificationsMeta", "Unread")
    setTextContent("statResumeMeta", isRecruiter ? "Active" : (user?.resume ? "Uploaded" : "Missing"))
}

function updateDashboardIntro(user) {
    const name = user?.name || localStorage.getItem("name") || "there"
    const role = user?.role || getRole()
    const firstName = String(name).trim().split(/\s+/)[0] || "there"
    const isRecruiter = role === "recruiter"
    const nextStepLink = document.getElementById("nextStepLink")

    setTextContent("dashboardGreeting", `Welcome back, ${firstName}`)
    setTextContent("nextStepTitle", isRecruiter ? "Post Job" : "Resume")

    if (nextStepLink) {
        nextStepLink.href = isRecruiter ? "postjob.html" : "profile.html"
        nextStepLink.textContent = isRecruiter ? "Post" : "Open"
    }
}

function updateProfilePage(user) {
    setTextContent("profilePageName", user?.name || "User")
    setTextContent("profilePageEmail", user?.email || "-")
    setTextContent("profilePageRole", formatRoleLabel(user?.role || "jobseeker"))
    setTextContent("profilePageJoined", formatDate(user?.createdAt))
    setTextContent("profileResumeStatus", user?.role === "recruiter" ? "Recruiter account" : (user?.resume ? "Resume uploaded" : "Resume pending"))
    setTextContent("profileHeadlineText", user?.headline || "Add a headline to introduce yourself.")
    setTextContent("profilePhoneText", user?.phone || "-")
    setTextContent("profileLocationText", user?.location || "-")
    setTextContent("profileCompanyText", user?.company || "-")
    setTextContent("profileWebsiteText", user?.website || "-")
    setTextContent("profileBioText", user?.bio || "No profile summary added yet.")

    const profileImage = document.getElementById("profileImagePreview")
    if (profileImage) {
        const imageUrl = getAssetUrl(user?.profileImage)
        profileImage.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : ""
        profileImage.style.backgroundSize = imageUrl ? "cover" : ""
        profileImage.style.backgroundPosition = imageUrl ? "center" : ""
        profileImage.textContent = imageUrl ? "" : getUserInitials(user?.name)
    }

    const fields = {
        profileNameInput: user?.name || "",
        profilePhoneInput: user?.phone || "",
        profileLocationInput: user?.location || "",
        profileCompanyInput: user?.company || "",
        profileHeadlineInput: user?.headline || "",
        profileWebsiteInput: user?.website || "",
        profileSkillsInput: user?.skills || "",
        profileBioInput: user?.bio || ""
    }

    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id)
        if (el) el.value = value
    })

    const skillsList = document.getElementById("profileSkillsList")
    if (skillsList) {
        const skills = String(user?.skills || "")
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean)

        skillsList.innerHTML = skills.length
            ? skills.map((skill) => `<span class="skillPill">${escapeHtml(skill)}</span>`).join("")
            : "<span class=\"skillPill mutedSkill\">No skills added</span>"
    }

    const resumeEl = document.getElementById("resumeLink")
    if (!resumeEl) return

    if (user?.resume) {
        resumeEl.href = getAssetUrl(user.resume)
        resumeEl.textContent = "View uploaded resume"
        resumeEl.style.display = "inline-flex"
    } else {
        resumeEl.style.display = "none"
    }
}

async function saveProfile() {
    if (!checkAuth()) return

    const payload = {
        name: document.getElementById("profileNameInput")?.value?.trim() || "",
        phone: document.getElementById("profilePhoneInput")?.value?.trim() || "",
        location: document.getElementById("profileLocationInput")?.value?.trim() || "",
        company: document.getElementById("profileCompanyInput")?.value?.trim() || "",
        headline: document.getElementById("profileHeadlineInput")?.value?.trim() || "",
        website: document.getElementById("profileWebsiteInput")?.value?.trim() || "",
        skills: document.getElementById("profileSkillsInput")?.value?.trim() || "",
        bio: document.getElementById("profileBioInput")?.value?.trim() || ""
    }

    if (!payload.name) {
        alert("Name is required")
        return
    }

    const res = await fetch(API + "/auth/profile", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: getToken()
        },
        body: JSON.stringify(payload)
    })
    const data = await safeJson(res)

    if (res.ok && data.user) {
        currentUserCache = data.user
        localStorage.setItem("name", data.user.name || "")
        updateProfilePage(data.user)
        populateSharedShell(data.user, getPageKey())
        alert("Profile updated")
    } else {
        alert(data.msg || "Profile update failed")
    }
}

async function uploadAvatar() {
    if (!checkAuth()) return

    const input = document.getElementById("avatarFile")
    const file = input?.files?.[0]
    if (!file) {
        alert("Select a profile image first")
        return
    }

    const formData = new FormData()
    formData.append("avatar", file)

    const res = await fetch(API + "/auth/upload-avatar", {
        method: "POST",
        headers: { Authorization: getToken() },
        body: formData
    })
    const data = await safeJson(res)

    if (res.ok && data.user) {
        currentUserCache = data.user
        updateProfilePage(data.user)
        populateSharedShell(data.user, getPageKey())
        alert("Profile image uploaded")
    } else {
        alert(data.msg || "Profile image upload failed")
    }
}

function resetProfileForm() {
    if (currentUserCache) {
        updateProfilePage(currentUserCache)
    }
}

function previewAvatarSelection() {
    const input = document.getElementById("avatarFile")
    const preview = document.getElementById("profileImagePreview")
    const file = input?.files?.[0]
    if (!file || !preview) return

    const imageUrl = URL.createObjectURL(file)
    preview.style.backgroundImage = `url("${imageUrl}")`
    preview.style.backgroundSize = "cover"
    preview.style.backgroundPosition = "center"
    preview.textContent = ""
}

async function uploadResume() {
    if (!ensureRole("jobseeker")) return

    const input = document.getElementById("resumeFile")
    const file = input?.files?.[0]
    if (!file) {
        alert("Select a resume file first")
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
        alert("Resume uploaded")
        currentUserCache = data.user
        updateProfilePage(data.user)
        populateSharedShell(data.user, getPageKey())
    } else {
        alert(data.msg || "Resume upload failed")
    }
}

function ensureRole(requiredRole) {
    const currentRole = getRole()
    if (!currentRole) {
        alert("Please login first")
        window.location.href = "login.html"
        return false
    }

    if (currentRole === requiredRole) return true

    alert(`You are logged in as ${formatRoleLabel(currentRole)}. Please use ${formatRoleLabel(requiredRole)} account.`)
    return false
}

async function loadJobsPage() {
    const filters = {
        title: document.getElementById("searchTitle")?.value?.trim() || "",
        location: document.getElementById("searchLocation")?.value?.trim() || "",
        company: document.getElementById("searchCompany")?.value?.trim() || "",
        minSalary: document.getElementById("minSalary")?.value?.trim() || ""
    }

    try {
        const jobs = await fetchJobs(filters)
        renderJobs("jobsList", jobs, { emptyMessage: "No jobs found for the current filters." })
        setTextContent("jobsPageCount", `${jobs.length} jobs found`)
    } catch {
        setHtml("jobsList", "<p class=\"emptyState\">Unable to load jobs.</p>")
    }
}

async function searchJobs() {
    await loadJobsPage()
}

async function clearSearch(event) {
    if (event) event.preventDefault()
    ;["searchTitle", "searchLocation", "searchCompany", "minSalary"].forEach((id) => {
        const el = document.getElementById(id)
        if (el) el.value = ""
    })
    await loadJobsPage()
}

async function applyJob(jobId) {
    if (!ensureRole("jobseeker")) return

    const user = await getCurrentUser(true)
    if (!user?._id) return
    const missingItems = []
    if (!user.resume) missingItems.push("resume")
    if (!user.phone) missingItems.push("phone")
    if (!user.location) missingItems.push("location")
    if (!user.skills) missingItems.push("skills")

    if (missingItems.length) {
        const ok = window.confirm(`Your profile is missing ${missingItems.join(", ")}. Apply anyway? Recruiter will only receive saved details.`)
        if (!ok) {
            window.location.href = "profile.html"
            return
        }
    }

    const res = await fetch(API + "/applications/apply/" + jobId, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: getToken()
        }
    })
    const data = await safeJson(res)

    if (res.ok) {
        alert("Applied successfully")
        await refreshCurrentPage()
    } else {
        alert(data.msg || "Application failed")
    }
}

async function deleteJob(jobId) {
    if (!ensureRole("recruiter")) return

    const ok = window.confirm("Delete this job post?")
    if (!ok) return

    const res = await fetch(API + "/jobs/" + jobId, {
        method: "DELETE",
        headers: { Authorization: getToken() }
    })
    const data = await safeJson(res)

    if (res.ok) {
        alert("Job deleted")
        await refreshCurrentPage()
    } else {
        alert(data.msg || "Delete failed")
    }
}

async function loadApplicationsPage() {
    const user = await getCurrentUser()
    if (!user?._id) return

    if (user.role === "recruiter") {
        const apps = await fetchReceivedApplications()
        setTextContent("applicationsPageTitle", "Received Applications")
        setTextContent("applicationsPageSubtitle", "Review applications from candidates who applied to your jobs.")
        renderRecruiterApplications("applicationsList", apps)
        setTextContent("applicationsCountLabel", `${apps.length} applications`)
    } else {
        const apps = await fetchMyApplications()
        setTextContent("applicationsPageTitle", "My Applications")
        setTextContent("applicationsPageSubtitle", "Track the roles you have already applied for.")
        renderJobseekerApplications("applicationsList", apps)
        setTextContent("applicationsCountLabel", `${apps.length} applications`)
    }
}

async function loadNotificationsPage() {
    const notifications = await fetchNotifications()
    renderNotifications("notificationsList", notifications)
    setTextContent("notificationsCountLabel", `${notifications.length} notifications`)
}

async function markNotificationRead(id) {
    await fetch(API + `/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: getToken() }
    })
    await refreshCurrentPage()
}

async function markAllRead() {
    await fetch(API + "/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: getToken() }
    })
    await refreshCurrentPage()
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
        alert("Title, company, location, and description are required")
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
            alert("Job posted")
            window.location.href = "jobs.html"
        } else {
            alert(data.msg || "Post job failed")
        }
    } finally {
        isPostingJob = false
    }
}

async function loadOverviewPage() {
    const user = await getCurrentUser()
    if (!user?._id) return

    const [jobs, notifications, applications] = await Promise.all([
        fetchJobs(),
        fetchNotifications(),
        user.role === "recruiter" ? fetchReceivedApplications() : fetchMyApplications()
    ])

    updateOverviewStats(user, jobs, notifications, applications)
    renderJobs("overviewJobs", jobs, { limit: 3, emptyMessage: "No jobs available right now." })
    renderNotifications("overviewNotifications", notifications, { limit: 4, emptyMessage: "No notifications yet." })

    if (user.role === "recruiter") {
        setTextContent("overviewApplicationsTitle", "Candidates")
        renderRecruiterApplications("overviewApplications", applications, { limit: 3, emptyMessage: "No applications received yet." })
    } else {
        setTextContent("overviewApplicationsTitle", "Applications")
        renderJobseekerApplications("overviewApplications", applications, { limit: 3, emptyMessage: "No applications yet." })
    }
}

async function initOverviewPage() {
    if (!checkAuth()) return
    const user = await getCurrentUser()
    if (!user?._id) return
    populateSharedShell(user, "overview")
    updateDashboardIntro(user)
    await loadOverviewPage()
}

async function initJobsPage() {
    if (!checkAuth()) return
    const user = await getCurrentUser()
    if (!user?._id) return
    populateSharedShell(user, "jobs")
    await loadJobsPage()
}

async function initApplicationsPage() {
    if (!checkAuth()) return
    const user = await getCurrentUser()
    if (!user?._id) return
    populateSharedShell(user, "applications")
    await loadApplicationsPage()
}

async function initNotificationsPage() {
    if (!checkAuth()) return
    const user = await getCurrentUser()
    if (!user?._id) return
    populateSharedShell(user, "notifications")
    await loadNotificationsPage()
}

async function initProfilePage() {
    if (!checkAuth()) return
    const user = await getCurrentUser()
    if (!user?._id) return
    populateSharedShell(user, "profile")
    updateProfilePage(user)
}

async function initPostJobPage() {
    if (!checkAuth()) return
    const user = await getCurrentUser()
    if (!user?._id) return
    populateSharedShell(user, "postjob")
    if (user.role !== "recruiter") {
        alert("Only recruiter can post jobs")
        window.location.href = "dashboard.html"
    }
}

async function refreshCurrentPage() {
    const page = getPageKey()
    if (page === "overview") return initOverviewPage()
    if (page === "jobs") return initJobsPage()
    if (page === "applications") return initApplicationsPage()
    if (page === "notifications") return initNotificationsPage()
    if (page === "profile") return initProfilePage()
    return Promise.resolve()
}

if (typeof window !== "undefined") {
    window.register = register
    window.login = login
    window.logout = logout
    window.togglePassword = togglePassword
    window.searchJobs = searchJobs
    window.clearSearch = clearSearch
    window.applyJob = applyJob
    window.deleteJob = deleteJob
    window.markNotificationRead = markNotificationRead
    window.markAllRead = markAllRead
    window.uploadResume = uploadResume
    window.uploadAvatar = uploadAvatar
    window.saveProfile = saveProfile
    window.resetProfileForm = resetProfileForm
    window.previewAvatarSelection = previewAvatarSelection
    window.postJob = postJob
    window.initOverviewPage = initOverviewPage
    window.initJobsPage = initJobsPage
    window.initApplicationsPage = initApplicationsPage
    window.initNotificationsPage = initNotificationsPage
    window.initProfilePage = initProfilePage
    window.initPostJobPage = initPostJobPage
}

document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn")
    const searchBtn = document.getElementById("searchBtn")
    const clearBtn = document.getElementById("clearBtn")
    const markAllBtn = document.getElementById("markAllBtn")
    const resumeBtn = document.getElementById("resumeBtn")
    const avatarFile = document.getElementById("avatarFile")
    const avatarBtn = document.getElementById("avatarBtn")
    const profileSaveBtn = document.getElementById("profileSaveBtn")
    const profileResetBtn = document.getElementById("profileResetBtn")
    const postJobBtn = document.getElementById("postJobBtn")
    const passwordInput = document.getElementById("password")

    if (logoutBtn) logoutBtn.addEventListener("click", logout)
    if (searchBtn) searchBtn.addEventListener("click", searchJobs)
    if (clearBtn) clearBtn.addEventListener("click", clearSearch)
    if (markAllBtn) markAllBtn.addEventListener("click", markAllRead)
    if (resumeBtn) resumeBtn.addEventListener("click", uploadResume)
    if (avatarFile) avatarFile.addEventListener("change", previewAvatarSelection)
    if (avatarBtn) avatarBtn.addEventListener("click", uploadAvatar)
    if (profileSaveBtn) profileSaveBtn.addEventListener("click", saveProfile)
    if (profileResetBtn) profileResetBtn.addEventListener("click", resetProfileForm)
    if (postJobBtn) postJobBtn.addEventListener("click", postJob)
    if (passwordInput) passwordInput.addEventListener("input", () => updatePasswordStrength("password", "passwordStrength"))

    ;["searchTitle", "searchLocation", "searchCompany", "minSalary"].forEach((id) => {
        const el = document.getElementById(id)
        if (!el) return
        el.addEventListener("keydown", (event) => {
            if (event.key === "Enter") searchJobs()
        })
    })
})
