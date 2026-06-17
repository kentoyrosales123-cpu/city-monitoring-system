const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token || user.role !== "admin") {
  window.location.href = "/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const els = {
  adminName: document.getElementById("adminName"),
  adminRole: document.getElementById("adminRole"),
  currentDate: document.getElementById("currentDate"),
  currentTime: document.getElementById("currentTime"),
  totalUsers: document.getElementById("totalUsers"),
  totalAgencies: document.getElementById("totalAgencies"),
  liveResponders: document.getElementById("liveResponders"),
  totalIncidents: document.getElementById("totalIncidents"),
  incidentsTable: document.getElementById("incidentsTable"),
  donutTotal: document.getElementById("donutTotal"),
  incidentTypeList: document.getElementById("incidentTypeList"),
  resolvedPercent: document.getElementById("resolvedPercent"),
  statusList: document.getElementById("statusList"),
  policeCount: document.getElementById("policeCount"),
  fireCount: document.getElementById("fireCount"),
  medicalCount: document.getElementById("medicalCount"),
  drrmCount: document.getElementById("drrmCount"),
  userMessage: document.getElementById("userMessage"),
  createUserForm: document.getElementById("createUserForm"),
  logoutBtn: document.getElementById("logoutBtn"),
};

els.adminName.textContent = user.name || "Admin User";
els.adminRole.textContent = user.rank || user.position || "System Administrator";

function updateClock() {
  const now = new Date();
  els.currentDate.textContent = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  els.currentTime.textContent = now.toLocaleDateString("en-US", {
    weekday: "long",
  }) + ", " + now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function incidentTypeIcon(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("fire")) return "fa-fire-flame-curved";
  if (normalized.includes("medical")) return "fa-briefcase-medical";
  if (normalized.includes("traffic")) return "fa-car";
  if (normalized.includes("crime") || normalized.includes("security")) return "fa-shield-halved";
  if (normalized.includes("disaster") || normalized.includes("flood")) return "fa-water";
  return "fa-triangle-exclamation";
}

function severityBadge(severity) {
  const normalized = String(severity || "medium").toLowerCase();
  if (normalized.includes("critical")) return "badge-critical";
  if (normalized.includes("high")) return "badge-high";
  if (normalized.includes("low")) return "badge-low";
  return "badge-medium";
}

function statusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("resolved") || normalized.includes("active")) return "badge-resolved";
  if (normalized.includes("ongoing") || normalized.includes("pending")) return "badge-ongoing";
  if (normalized.includes("validation") || normalized.includes("review")) return "badge-pending";
  return "badge-pending";
}

function pickSeverity(incident) {
  return incident.severity || incident.priority || incident.riskLevel || "Medium";
}

function pickStatus(incident) {
  return incident.status || incident.responseStatus || "For Validation";
}

function pickLocation(incident) {
  return incident.barangay || incident.location || incident.address || "Unspecified";
}

function pickReportedAt(incident) {
  const rawDate = incident.createdAt || incident.reportedAt || incident.updatedAt;
  if (!rawDate) return "-";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = formatLabel(getKey(item) || "Unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function fetchData(url) {
  const response = await fetch(url, { headers });

  if (response.status === 401 || response.status === 403) {
    localStorage.clear();
    window.location.href = "/login.html";
    return [];
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || [];
}

async function loadDashboard() {
  try {
    const [users, agencies, responders, incidents] = await Promise.all([
      fetchData("/api/users"),
      fetchData("/api/agencies"),
      fetchData("/api/gps/live-responders"),
      fetchData("/api/incidents"),
    ]);

    els.totalUsers.textContent = users.length;
    els.totalAgencies.textContent = agencies.length;
    els.liveResponders.textContent = responders.length;
    els.totalIncidents.textContent = incidents.length;
    els.donutTotal.textContent = incidents.length;

    renderIncidents(incidents);
    renderIncidentTypes(incidents);
    renderStatusBreakdown(incidents);
    renderUnitCounts(users);
  } catch (error) {
    console.error(error);
    els.incidentsTable.innerHTML = `<tr><td colspan="7">Unable to load dashboard data.</td></tr>`;
  }
}

function renderIncidents(incidents) {
  if (!incidents.length) {
    els.incidentsTable.innerHTML = `<tr><td colspan="7">No incidents reported.</td></tr>`;
    return;
  }

  els.incidentsTable.innerHTML = incidents
    .slice(0, 6)
    .map((incident, index) => {
      const severity = pickSeverity(incident);
      const status = pickStatus(incident);
      const incidentId = incident.incidentId || `INC-2026-${String(incidents.length - index).padStart(3, "0")}`;
      const type = incident.type || "Incident";

      return `
        <tr>
          <td>${incidentId}</td>
          <td>${incident.title || "Reported Incident"}</td>
          <td><i class="fa-solid ${incidentTypeIcon(type)}"></i> ${formatLabel(type)}</td>
          <td>${pickLocation(incident)}</td>
          <td><span class="badge ${severityBadge(severity)}">${formatLabel(severity)}</span></td>
          <td><span class="badge ${statusBadge(status)}">${formatLabel(status)}</span></td>
          <td>${pickReportedAt(incident)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderIncidentTypes(incidents) {
  const fallback = {
    "Medical Emergency": 45,
    "Fire Incident": 32,
    "Traffic Accident": 31,
    "Crime / Security": 25,
    "Natural Disaster": 23,
  };
  const source = incidents.length ? countBy(incidents, (incident) => incident.type || "Incident") : fallback;
  const total = Object.values(source).reduce((sum, value) => sum + value, 0) || 1;
  const colors = ["#8d55e8", "#ff415c", "#ff9f1a", "#2f9cf4", "#20d181"];

  els.incidentTypeList.innerHTML = Object.entries(source)
    .slice(0, 5)
    .map(([label, count], index) => {
      const percent = ((count / total) * 100).toFixed(1);
      return `
        <div>
          <i class="chart-dot" style="background:${colors[index % colors.length]}"></i>
          <span>${label}</span>
          <strong>${count} (${percent}%)</strong>
        </div>
      `;
    })
    .join("");
}

function renderStatusBreakdown(incidents) {
  const fallback = {
    Resolved: 147,
    Ongoing: 7,
    "For Validation": 2,
  };
  const source = incidents.length ? countBy(incidents, pickStatus) : fallback;
  const total = Object.values(source).reduce((sum, value) => sum + value, 0) || 1;
  const resolved = Object.entries(source)
    .filter(([label]) => label.toLowerCase().includes("resolved"))
    .reduce((sum, [, value]) => sum + value, 0);
  const colors = ["#20d181", "#ff9f1a", "#2f9cf4", "#8d55e8"];

  els.resolvedPercent.textContent = `${Math.round((resolved / total) * 100)}%`;
  els.statusList.innerHTML = Object.entries(source)
    .slice(0, 4)
    .map(([label, count], index) => `
      <div>
        <i class="chart-dot" style="background:${colors[index % colors.length]}"></i>
        <span>${label}</span>
        <strong>${count}</strong>
      </div>
    `)
    .join("");
}

function renderUnitCounts(users) {
  const countRole = (role) => users.filter((u) => String(u.role || "").toLowerCase() === role).length;
  els.policeCount.textContent = countRole("police");
  els.fireCount.textContent = countRole("fire");
  els.medicalCount.textContent = countRole("medical");
  els.drrmCount.textContent = countRole("drrm");
}

els.createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  els.userMessage.className = "message";
  els.userMessage.textContent = "";

  const body = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value.trim(),
    role: document.getElementById("role").value,
    rank: document.getElementById("rank").value.trim(),
    unit: document.getElementById("unit").value.trim(),
    status: document.getElementById("status").value,
  };

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create user");
    }

    els.userMessage.className = "message success";
    els.userMessage.textContent = "Personnel created successfully.";
    event.target.reset();
    loadDashboard();
  } catch (error) {
    els.userMessage.className = "message error";
    els.userMessage.textContent = error.message;
  }
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

updateClock();
setInterval(updateClock, 30000);
loadDashboard();

if (typeof io === "function") {
  const socket = io();
  socket.on("responderStatusUpdated", loadDashboard);
  socket.on("responderLocationUpdated", loadDashboard);
}
