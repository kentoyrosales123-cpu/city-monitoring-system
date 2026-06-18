const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

const allowedRoles = ["responder", "police", "fire", "medical", "drrm", "barangay"];

if (!token || !user || !allowedRoles.includes(user.role)) {
  localStorage.clear();
  window.location.href = "/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const els = {
  responderName: document.getElementById("responderName"),
  responderRole: document.getElementById("responderRole"),
  responderAvatar: document.getElementById("responderAvatar"),
  statusSummary: document.getElementById("statusSummary"),
  statusButtons: document.querySelectorAll(".status-toggle button"),
  topResponderName: document.getElementById("topResponderName"),
  topResponderRole: document.getElementById("topResponderRole"),
  activeIncidents: document.getElementById("activeIncidents"),
  criticalText: document.getElementById("criticalText"),
  myAssignments: document.getElementById("myAssignments"),
  responseTime: document.getElementById("responseTime"),
  missionsCompleted: document.getElementById("missionsCompleted"),
  navIncidentCount: document.getElementById("navIncidentCount"),
  currentLocation: document.getElementById("currentLocation"),
  vehicleUnit: document.getElementById("vehicleUnit"),
  recentAlerts: document.getElementById("recentAlerts"),
  assignmentId: document.getElementById("assignmentId"),
  assignmentSeverity: document.getElementById("assignmentSeverity"),
  assignmentTitle: document.getElementById("assignmentTitle"),
  assignmentLocation: document.getElementById("assignmentLocation"),
  assignmentTime: document.getElementById("assignmentTime"),
  assignmentDetails: document.getElementById("assignmentDetails"),
  logoutBtn: document.getElementById("logoutBtn"),
  profileSummary: document.getElementById("profileSummary"),
  profileFullName: document.getElementById("profileFullName"),
  profileRole: document.getElementById("profileRole"),
  profileEmail: document.getElementById("profileEmail"),
  profileAgency: document.getElementById("profileAgency"),
  profileRank: document.getElementById("profileRank"),
  profileUnit: document.getElementById("profileUnit"),
  profileAccountStatus: document.getElementById("profileAccountStatus"),
  profileResponderStatus: document.getElementById("profileResponderStatus"),
};

const roleLabels = {
  police: "Police Responder",
  fire: "Fire Responder",
  medical: "Medical Responder",
  drrm: "DRRM Responder",
  barangay: "Barangay Responder",
  responder: "Field Responder",
};

els.responderName.textContent = user.name || "Responder";
els.topResponderName.textContent = user.name || "Responder";
els.responderRole.textContent = roleLabels[user.role] || "Responder";
els.topResponderRole.textContent = roleLabels[user.role] || "Responder";
els.vehicleUnit.textContent = user.unit || "PCR-12";
setStatusUI(normalizeStatus(user.status));

function renderAvatar(photo, name) {
  if (!photo) return `<i class="fa-solid fa-user"></i>`;
  return `<img src="${photo}" alt="${name || "User"} photo" />`;
}

function renderProfile(profile) {
  const status = normalizeStatus(profile.responderStatus || profile.status);
  const roleLabel = roleLabels[profile.role] || formatLabel(profile.role);
  const agencyName = profile.agency?.name || profile.agency || "N/A";

  els.responderName.textContent = profile.name || "Responder";
  els.topResponderName.textContent = profile.name || "Responder";
  els.responderRole.textContent = roleLabel;
  els.topResponderRole.textContent = roleLabel;
  els.vehicleUnit.textContent = profile.unit || "N/A";
  els.responderAvatar.innerHTML = renderAvatar(profile.photo, profile.name);

  els.profileSummary.textContent = `${roleLabel} - ${profile.unit || "No unit assigned"}`;
  els.profileFullName.textContent = profile.name || "Responder";
  els.profileRole.textContent = roleLabel;
  els.profileEmail.textContent = profile.email || "N/A";
  els.profileAgency.textContent = agencyName;
  els.profileRank.textContent = profile.rank || "N/A";
  els.profileUnit.textContent = profile.unit || "N/A";
  els.profileAccountStatus.textContent = formatLabel(profile.accountStatus || "active");
  els.profileResponderStatus.textContent = formatLabel(status);

  user.name = profile.name;
  user.email = profile.email;
  user.role = profile.role;
  user.agency = profile.agency;
  user.rank = profile.rank;
  user.unit = profile.unit;
  user.accountStatus = profile.accountStatus;
  user.responderStatus = status;
  user.status = status;
  user.photo = profile.photo;
  localStorage.setItem("user", JSON.stringify(user));
  setStatusUI(status);
}

function normalizeStatus(status) {
  if (status === "responding") return "responding";
  if (status === "busy") return "busy";
  if (status === "offline" || status === "off_duty" || status === "inactive") return "offline";
  return "available";
}

function setStatusUI(status) {
  const statusCopy = {
    available: "Ready for dispatch",
    busy: "Occupied with task",
    responding: "Currently assigned",
    offline: "Unavailable for calls",
  };

  els.statusButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.status === status);
  });

  els.statusSummary.textContent = statusCopy[status] || "Ready for dispatch";
}

async function updateResponderStatus(status, options = {}) {
  try {
    const response = await fetch("/api/users/me/status", {
      method: "PUT",
      headers,
      body: JSON.stringify({ status }),
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to update status");
    }

    const data = await response.json();

    user.status = normalizeStatus(data.user.responderStatus || data.user.status);
    user.responderStatus = user.status;
    localStorage.setItem("user", JSON.stringify(user));
    setStatusUI(user.status);
    return true;
  } catch (error) {
    console.error(error);
    setStatusUI(normalizeStatus(user.status));
    if (!options.silent) {
      alert("Unable to update status.");
    }
    return false;
  }
}

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
  if (raw.includes("moderate") || raw.includes("medium")) return "moderate";

  const type = String(incident.type || "").toLowerCase();
  if (type.includes("fire") || type.includes("crime")) return "critical";
  if (type.includes("traffic")) return "high";
  if (type.includes("medical") || type.includes("flood")) return "moderate";
  return "low";
}

function incidentIcon(incident) {
  const type = String(incident.type || "").toLowerCase();
  if (type.includes("fire")) return "fa-fire-flame-curved";
  if (type.includes("traffic")) return "fa-triangle-exclamation";
  if (type.includes("medical")) return "fa-briefcase-medical";
  return "fa-triangle-exclamation";
}

function formatTime(dateValue) {
  const date = new Date(dateValue || Date.now());
  if (Number.isNaN(date.getTime())) return "Today";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchData(url) {
  const response = await fetch(url, { headers });

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/login.html";
    return [];
  }

  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || [];
}

async function verifySession() {
  try {
    const response = await fetch("/api/auth/me", { headers });

    if (!response.ok) {
      localStorage.clear();
      window.location.href = "/login.html";
      return;
    }

    const profile = await response.json();
    renderProfile(profile);
  } catch (error) {
    localStorage.clear();
    window.location.href = "/login.html";
  }
}

async function updateLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      await fetch("/api/gps/update-location", {
        method: "POST",
        headers,
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      });
    } catch (error) {
      console.warn("Location update failed", error);
    }
  });
}

async function loadDashboard() {
  try {
    const incidents = await fetchData("/api/incidents");
    const active = incidents.filter(isActiveIncident);
    const critical = active.filter((incident) => incidentSeverity(incident) === "critical");
    const assignment = active[0] || null;

    els.activeIncidents.textContent = active.length || 2;
    els.criticalText.textContent = `${critical.length || 2} Critical`;
    els.navIncidentCount.textContent = active.length || 2;
    els.myAssignments.textContent = assignment ? "1" : "0";
    els.responseTime.textContent = "04:35";
    els.missionsCompleted.textContent = "24";

    if (assignment) {
  renderAssignment(assignment);
} else {
  clearAssignment();
}

renderAlerts(active);
  } catch (error) {
    console.error(error);
    const fallback = fallbackIncidents();
    els.activeIncidents.textContent = "2";
    els.criticalText.textContent = "2 Critical";
    els.navIncidentCount.textContent = "2";
    renderAssignment(fallback[0]);
    renderAlerts(fallback);
  }
}

function clearAssignment() {
  els.assignmentId.textContent = "No Active Incident";
  els.assignmentSeverity.textContent = "Standby";
  els.assignmentTitle.textContent = "Awaiting Dispatch";
  els.assignmentLocation.textContent = "No assigned location";
  els.assignmentTime.textContent = "No active assignment";
  els.assignmentDetails.textContent = "You currently have no assigned incident.";
}

function renderAssignment(incident) {
  const severity = incidentSeverity(incident);
  const id = incident.incidentId || "INC-2024-0058";
  els.assignmentId.textContent = `Incident #${id}`;
  els.assignmentSeverity.textContent = formatLabel(severity);
  els.assignmentTitle.textContent = incident.title || `${formatLabel(incident.type)} Incident`;
  els.assignmentLocation.textContent = incident.barangay || incident.location || "Barangay 5, Dela Paz St.";
  els.assignmentTime.textContent = `Today, ${formatTime(incident.createdAt)}`;
  els.assignmentDetails.textContent = incident.description || "Residential fire reported. Possible occupants trapped. Need immediate assistance.";
  els.currentLocation.textContent = incident.barangay || "Barangay 5, City Center";
}

function renderAlerts(incidents) {
  if (!incidents.length) {
    els.recentAlerts.innerHTML = `
      <div class="empty-alerts">
        No active incident notifications.
      </div>
    `;
    return;
  }

  els.recentAlerts.innerHTML = incidents.slice(0, 3).map((incident) => {
    const severity = incidentSeverity(incident);
    const displaySeverity = severity === "moderate" || severity === "low" ? "moderate" : severity;

    return `
      <div class="alert-item">
        <div class="alert-icon ${displaySeverity}">
          <i class="fa-solid ${incidentIcon(incident)}"></i>
        </div>
        <div class="alert-main">
          <strong>${incident.title || `${formatLabel(incident.type)} Incident`}</strong>
          <span>${incident.barangay || incident.location || "Unknown location"}</span>
        </div>
        <div class="alert-meta">
          <span>${formatTime(incident.createdAt)}</span>
          <strong class="${displaySeverity}">${formatLabel(displaySeverity)}</strong>
        </div>
      </div>
    `;
  }).join("");
}

function fallbackIncidents() {
  return [
    {
      incidentId: "INC-2024-0058",
      title: "Fire Incident",
      type: "fire",
      severity: "critical",
      barangay: "Barangay 5, Dela Paz St.",
      description: "Residential fire reported. Possible occupants trapped. Need immediate assistance.",
      createdAt: Date.now() - 60000,
    },
    {
      title: "Traffic Accident",
      type: "traffic",
      severity: "high",
      barangay: "Barangay 2, Rizal Ave.",
      createdAt: Date.now() - 26 * 60000,
    },
    {
      title: "Medical Emergency",
      type: "medical",
      severity: "moderate",
      barangay: "Barangay 7, Mabini St.",
      createdAt: Date.now() - 52 * 60000,
    },
  ];
}

els.logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers,
    });
  } finally {
    localStorage.clear();
    window.location.href = "/login.html";
  }
});

window.addEventListener("beforeunload", () => {
  fetch("/api/users/me/status", {
    method: "PUT",
    headers,
    body: JSON.stringify({ status: "offline" }),
    keepalive: true,
  });
});

els.statusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextStatus = button.dataset.status;
    setStatusUI(nextStatus);
    updateResponderStatus(nextStatus);
  });
});

const socket = io();
socket.emit("registerUser", user.id || user._id);

socket.on("incidentCreated", (data) => {
  console.log("New incident:", data);

  loadDashboard();

  showIncidentNotification(
    data.incident.title,
    data.incident.type
  );
});

socket.on("incidentStatusUpdated", (data) => {
  console.log("Incident updated:", data);

  loadDashboard();
});

socket.on("testConnection", (data) => {
  console.log("TEST EVENT RECEIVED:", data.message);

});

socket.on("responderStatusUpdated", () => {
  loadDashboard();
});

function showIncidentNotification(title, type) {
  const popup = document.createElement("div");

  popup.className = "incident-popup";

  popup.innerHTML = `
    <strong>🚨 New Incident</strong>
    <p>${title}</p>
    <small>${type}</small>
  `;

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 5000);
}

verifySession();
updateResponderStatus(normalizeStatus(user.status), { silent: true });
setInterval(() => {
  updateResponderStatus(normalizeStatus(user.status), { silent: true });
}, 60000);
loadDashboard();
updateLocation();
