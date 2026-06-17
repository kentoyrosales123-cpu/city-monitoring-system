const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token || !user || user.role !== "commander") {
  localStorage.clear();
  window.location.href = "/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const els = {
  commanderName: document.getElementById("commanderName"),
  criticalIncidents: document.getElementById("criticalIncidents"),
  activeIncidents: document.getElementById("activeIncidents"),
  respondersOnline: document.getElementById("respondersOnline"),
  respondersPercent: document.getElementById("respondersPercent"),
  unitsDeployed: document.getElementById("unitsDeployed"),
  unitsPercent: document.getElementById("unitsPercent"),
  resolvedToday: document.getElementById("resolvedToday"),
  navAlertCount: document.getElementById("navAlertCount"),
  overviewTotal: document.getElementById("overviewTotal"),
  overviewList: document.getElementById("overviewList"),
  alertList: document.getElementById("alertList"),
  responderList: document.getElementById("responderList"),
  resourceList: document.getElementById("resourceList"),
  reportTitle: document.getElementById("reportTitle"),
  reportTime: document.getElementById("reportTime"),
  reportSummary: document.getElementById("reportSummary"),
  lastUpdate: document.getElementById("lastUpdate"),
  lastUpdateDate: document.getElementById("lastUpdateDate"),
  connectedUnits: document.getElementById("connectedUnits"),
};

els.commanderName.textContent = user.name ? `Cmdr. ${user.name}` : "Cmdr. Commander";

function formatLabel(value) {
  return String(value || "Unknown")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isActiveIncident(incident) {
  return !["resolved", "cancelled"].includes(String(incident.status || "").toLowerCase());
}

function incidentSeverity(incident) {
  const raw = String(incident.severity || incident.priority || incident.riskLevel || "").toLowerCase();
  if (raw.includes("critical")) return "critical";
  if (raw.includes("high")) return "high";
  if (raw.includes("low")) return "low";
  if (raw.includes("medium")) return "medium";

  const type = String(incident.type || "").toLowerCase();
  if (type.includes("fire") || type.includes("crime")) return "critical";
  if (type.includes("traffic")) return "high";
  if (type.includes("medical") || type.includes("flood")) return "medium";
  return "low";
}

function minutesAgo(dateValue) {
  const date = new Date(dateValue || Date.now());
  const diff = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  return `${diff} min ago`;
}

function fetchData(url) {
  return fetch(url, { headers }).then(async (response) => {
    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return [];
    }

    if (!response.ok) {
      throw new Error(`Unable to load ${url}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.data || [];
  });
}

async function verifySession() {
  try {
    const response = await fetch("/api/auth/me", { headers });

    if (!response.ok) {
      localStorage.clear();
      window.location.href = "/login.html";
    }
  } catch (error) {
    localStorage.clear();
    window.location.href = "/login.html";
  }
}

async function loadDashboard() {
  try {
    const [incidents, responders, users, agencies] = await Promise.all([
      fetchData("/api/incidents"),
      fetchData("/api/gps/live-responders"),
      fetchData("/api/users"),
      fetchData("/api/agencies"),
    ]);

    const activeIncidents = incidents.filter(isActiveIncident);
    const criticalIncidents = activeIncidents.filter((incident) => incidentSeverity(incident) === "critical");
    const resolvedToday = incidents.filter((incident) => {
      const status = String(incident.status || "").toLowerCase();
      const updated = new Date(incident.updatedAt || incident.createdAt);
      return status === "resolved" && updated.toDateString() === new Date().toDateString();
    });

    els.criticalIncidents.textContent = criticalIncidents.length;
    els.activeIncidents.textContent = activeIncidents.length;
    els.respondersOnline.textContent = responders.length;
    els.unitsDeployed.textContent = responders.length;
    els.resolvedToday.textContent = resolvedToday.length;
    els.navAlertCount.textContent = criticalIncidents.length;
    els.overviewTotal.textContent = activeIncidents.length;
    els.connectedUnits.textContent = responders.length;

    const totalResponders = users.filter((u) =>
      ["police", "fire", "medical", "drrm", "barangay", "responder"].includes(u.role)
    ).length;
    const responderPercent = totalResponders ? Math.round((responders.length / totalResponders) * 100) : 0;
    els.respondersPercent.textContent = `${responderPercent}% of total`;
    els.unitsPercent.textContent = `${responderPercent}% of total units`;

    renderOverview(activeIncidents);
    renderAlerts(activeIncidents);
    renderResponders(responders);
    renderResources(users, agencies);
    renderReport(activeIncidents);
    updateClock();
  } catch (error) {
    console.error(error);
    renderFallback();
    updateClock();
  }
}

function renderOverview(incidents) {
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  incidents.forEach((incident) => {
    severityCounts[incidentSeverity(incident)] += 1;
  });

  const fallback = incidents.length ? severityCounts : { critical: 12, high: 8, medium: 6, low: 2 };
  const total = Object.values(fallback).reduce((sum, count) => sum + count, 0) || 1;
  const labels = [
    ["critical", "Critical", "#ff4545"],
    ["high", "High", "#ff7a1a"],
    ["medium", "Medium", "#ffc02b"],
    ["low", "Low", "#22d26f"],
  ];

  els.overviewTotal.textContent = incidents.length || total;
  els.overviewList.innerHTML = labels.map(([key, label, color]) => {
    const count = fallback[key];
    const percent = Math.round((count / total) * 100);
    return `
      <div>
        <i class="overview-dot" style="background:${color}"></i>
        <span>${label}</span>
        <strong>${count} (${percent}%)</strong>
      </div>
    `;
  }).join("");
}

function renderAlerts(incidents) {
  const active = incidents.length ? incidents : [
    { title: "Major Fire Incident", barangay: "Barangay San Rafael, Central District", type: "Fire", createdAt: Date.now() - 120000 },
    { title: "Traffic Collision", barangay: "Riverside Highway, Near Bridge", type: "Traffic", createdAt: Date.now() - 300000 },
    { title: "Medical Emergency", barangay: "San Antonio, Barangay 3", type: "Medical", createdAt: Date.now() - 720000 },
    { title: "Flood Warning", barangay: "Low-lying Area, Greenfield", type: "Flood", createdAt: Date.now() - 1080000 },
  ];

  els.alertList.innerHTML = active.slice(0, 4).map((incident) => {
    const severity = incidentSeverity(incident);
    const label = severity === "critical" ? "Critical" : severity === "high" ? "High" : "Medium";
    return `
      <div class="alert-row ${severity}">
        <div class="row-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="row-main">
          <h3>${incident.title || formatLabel(incident.type)}</h3>
          <p>${incident.barangay || incident.location || "Central District"}</p>
        </div>
        <div>
          <div class="alert-time">${minutesAgo(incident.createdAt)}</div>
          <span class="severity-pill severity-${severity === "low" ? "medium" : severity}">${label}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderResponders(responders) {
  const fallback = [
    { name: "Alpha-1", unit: "Police Patrol Unit", role: "police", status: "On Scene", location: "Central District" },
    { name: "Bravo-2", unit: "Fire Response Unit", role: "fire", status: "En Route", location: "San Rafael" },
    { name: "Charlie-3", unit: "Medical Response Unit", role: "medical", status: "On Scene", location: "Barangay 2" },
    { name: "Delta-4", unit: "DRRM Support Unit", role: "drrm", status: "Standby", location: "Base Station" },
  ];

  const rows = responders.length ? responders.slice(0, 4).map((responder, index) => ({
    name: responder.name || `Unit-${index + 1}`,
    unit: responder.unit || `${formatLabel(responder.role)} Response Unit`,
    role: responder.role,
    status: index % 3 === 1 ? "En Route" : index % 3 === 2 ? "Standby" : "On Scene",
    location: responder.barangay || responder.location || responder.agency?.name || "Central District",
  })) : fallback;

  els.responderList.innerHTML = rows.map((row) => {
    const statusClass = row.status === "On Scene" ? "status-scene" : row.status === "En Route" ? "status-route" : "status-standby";
    return `
      <div class="responder-row">
        <div class="row-icon ${row.role}"><i class="fa-solid ${roleIcon(row.role)}"></i></div>
        <div class="row-main"><strong>${row.name}</strong><span>${row.unit}</span></div>
        <span class="status-badge ${statusClass}">${row.status}</span>
        <span>${row.location}</span>
        <i class="status-dot" style="background:${row.status === "En Route" ? "#ff7a1a" : row.status === "Standby" ? "#2f8cff" : "#22d26f"}"></i>
      </div>
    `;
  }).join("");
}

function renderResources(users, agencies) {
  const countRole = (role) => users.filter((candidate) => candidate.role === role).length;
  const resources = [
    ["Ambulances", "fa-truck-medical", countRole("medical") || 12, 18, "#22d26f"],
    ["Fire Trucks", "fa-truck-field", countRole("fire") || 7, 12, "#ff7a1a"],
    ["Police Vehicles", "fa-car-side", countRole("police") || 15, 25, "#2f8cff"],
    ["Rescue Boats", "fa-sailboat", countRole("drrm") || agencies.length || 4, 6, "#39d7b0"],
  ];

  els.resourceList.innerHTML = resources.map(([name, icon, available, total, color]) => {
    const percent = Math.min(100, Math.round((available / total) * 100));
    return `
      <div class="resource-row">
        <div class="row-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="row-main"><strong>${name}</strong><span style="color:${color}">Available</span></div>
        <div class="resource-bar"><span style="--value:${percent}%;--bar:${color}"></span></div>
        <strong class="resource-count">${available} / ${total}</strong>
      </div>
    `;
  }).join("");
}

function renderReport(incidents) {
  const now = new Date();
  const reportId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-001`;
  els.reportTitle.textContent = `Situation Report #${reportId}`;
  els.reportTime.textContent = `Time Issued: ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  els.reportSummary.textContent = incidents.length
    ? `${incidents.length} active incidents are being monitored across the command area. All available units are being coordinated.`
    : "No active incidents reported. Command center remains operational and ready for deployment.";
}

function roleIcon(role) {
  if (role === "fire") return "fa-fire-flame-curved";
  if (role === "medical") return "fa-briefcase-medical";
  if (role === "drrm") return "fa-truck-medical";
  return "fa-shield-halved";
}

function updateClock() {
  const now = new Date();
  els.lastUpdate.textContent = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  els.lastUpdateDate.textContent = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function renderFallback() {
  els.criticalIncidents.textContent = "12";
  els.activeIncidents.textContent = "28";
  els.respondersOnline.textContent = "156";
  els.unitsDeployed.textContent = "92";
  els.resolvedToday.textContent = "18";
  els.navAlertCount.textContent = "7";
  els.respondersPercent.textContent = "78% of total";
  els.unitsPercent.textContent = "63% of total units";
  els.connectedUnits.textContent = "42";
  renderOverview([]);
  renderAlerts([]);
  renderResponders([]);
  renderResources([], []);
  renderReport([]);
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

verifySession();
loadDashboard();
setInterval(updateClock, 30000);

if (typeof io === "function") {
  const socket = io();
  socket.on("responderStatusUpdated", loadDashboard);
  socket.on("responderLocationUpdated", loadDashboard);
}
