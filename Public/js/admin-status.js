const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const canViewStatus = ["admin", "commander"].includes(user.role);
const responderRoles = ["responder", "police", "fire", "medical", "drrm", "barangay"];

if (!token) {
  window.location.replace("/login.html");
  throw new Error("Authentication required");
}

if (!canViewStatus) {
  const target = responderRoles.includes(user.role) ? "/responder-dashboard.html" : "/login.html";
  window.location.replace(target);
  throw new Error("Status page is restricted to admin and commander accounts");
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const els = {
  adminName: document.getElementById("adminName"),
  adminRole: document.getElementById("adminRole"),
  logoutBtn: document.getElementById("logoutBtn"),
  currentDate: document.getElementById("currentDate"),
  currentTime: document.getElementById("currentTime"),
  totalPersonnelCount: document.getElementById("totalPersonnelCount"),
  onlineCount: document.getElementById("onlineCount"),
  availableCount: document.getElementById("availableCount"),
  busyCount: document.getElementById("busyCount"),
  respondingCount: document.getElementById("respondingCount"),
  policeCount: document.getElementById("policeCount"),
  fireCount: document.getElementById("fireCount"),
  emsCount: document.getElementById("emsCount"),
  drrmCount: document.getElementById("drrmCount"),
  barangayCount: document.getElementById("barangayCount"),
  agencyDistributionChart: document.getElementById("agencyDistributionChart"),
  agencyDistributionTotal: document.getElementById("agencyDistributionTotal"),
  agencyDistributionList: document.getElementById("agencyDistributionList"),
  personnelStatusChart: document.getElementById("personnelStatusChart"),
  personnelStatusTotal: document.getElementById("personnelStatusTotal"),
  personnelStatusList: document.getElementById("personnelStatusList"),
  recentActivityTable: document.getElementById("recentActivityTable"),
  statusFilter: document.getElementById("statusFilter"),
  agencyFilter: document.getElementById("agencyFilter"),
  stationFilter: document.getElementById("stationFilter"),
  barangayFilter: document.getElementById("barangayFilter"),
  statusTable: document.getElementById("statusTable"),
};

let responders = [];
let users = [];
let agencies = [];
let stations = [];
let barangays = [];
let statusActivities = [];

els.adminName.textContent = user.name || "Admin User";
els.adminRole.textContent = user.rank || user.position || "System Administrator";

function updateClock() {
  const now = new Date();
  els.currentDate.textContent = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  els.currentTime.textContent = `${now.toLocaleDateString("en-US", {
    weekday: "long",
  })}, ${now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatLabel(value) {
  return String(value || "-")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLastSeen(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status, isOnline) {
  if (!isOnline || status === "offline") return "status-gray";
  if (status === "available") return "status-green";
  if (status === "busy") return "status-yellow";
  if (status === "responding") return "status-red";
  return "status-gray";
}

function getId(value) {
  if (!value) return "";
  return typeof value === "string" ? value : value._id || "";
}

function agencyTypeLabel(type) {
  if (type === "medical") return "EMS";
  if (type === "drrm") return "DRRM";
  return formatLabel(type);
}

function agencyTypeColor(type) {
  const colors = {
    police: "#2f9cf4",
    fire: "#ff415c",
    medical: "#a77cff",
    drrm: "#20d181",
    barangay: "#ff9f1a",
  };
  return colors[type] || "#8ea2bb";
}

function getAgencyType(responder) {
  return responder.agency?.type || responder.role || "";
}

function getUserAgencyType(person) {
  return person.agency?.type || person.role || "";
}

function getAgencyFilterTypes() {
  return Array.from(new Set([
    ...agencies.map((agency) => agency.type),
    ...responders.map((responder) => getAgencyType(responder)),
  ].filter((type) => ["police", "fire", "medical", "drrm", "barangay"].includes(type))));
}

function stationBelongsToAgencyFilter(station) {
  return !els.agencyFilter.value
    || station.type === els.agencyFilter.value
    || station.agency?.type === els.agencyFilter.value;
}

function getStationOptions() {
  const seen = new Map();

  stations
    .filter(stationBelongsToAgencyFilter)
    .forEach((station) => {
      if (station._id && !seen.has(station._id)) {
        seen.set(station._id, station.name);
      }
    });

  responders
    .filter((responder) => !els.agencyFilter.value || getAgencyType(responder) === els.agencyFilter.value)
    .forEach((responder) => {
      const id = getId(responder.stationRef);
      const label = responder.stationRef?.name || responder.station;
      if (id && !seen.has(id)) {
        seen.set(id, label);
      }
    });

  return Array.from(seen.entries())
    .map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`)
    .join("");
}

function responderMatchesAgencyAndStation(responder) {
  return (!els.agencyFilter.value || getAgencyType(responder) === els.agencyFilter.value)
    && (!els.stationFilter.value || getId(responder.stationRef) === els.stationFilter.value);
}

function getBarangayOptions() {
  const seen = new Map();
  const matchingResponders = responders.filter(responderMatchesAgencyAndStation);

  if (!els.agencyFilter.value && !els.stationFilter.value) {
    barangays.forEach((barangay) => {
      if (barangay._id && !seen.has(barangay._id)) {
        seen.set(barangay._id, barangay.name);
      }
    });
  }

  matchingResponders.forEach((responder) => {
    const id = getId(responder.barangayRef);
    const label = responder.barangayRef?.name || responder.barangay;
    if (id && !seen.has(id)) {
      seen.set(id, label);
    }
  });

  return Array.from(seen.entries())
    .map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`)
    .join("");
}

function uniqueOptions(rows, getter, labelGetter) {
  const seen = new Map();
  rows.forEach((row) => {
    const value = getter(row);
    const id = getId(value);
    if (!id || seen.has(id)) return;
    seen.set(id, labelGetter(value));
  });
  return Array.from(seen.entries())
    .map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`)
    .join("");
}

async function fetchData(url) {
  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return [];
    }
    throw new Error(data.message || `Unable to load ${url}`);
  }

  return Array.isArray(data) ? data : [];
}

function countByType(type) {
  return users.filter((person) => getUserAgencyType(person) === type).length;
}

function countByStatus(status) {
  if (status === "offline") {
    return responders.filter((responder) => !responder.isOnline || (responder.responderStatus || "offline") === "offline").length;
  }

  return responders.filter((responder) => responder.isOnline && responder.responderStatus === status).length;
}

function renderDonut(chartEl, total, segments) {
  if (!total) {
    chartEl.style.background = "conic-gradient(rgba(129, 165, 205, 0.16) 0 100%)";
    return;
  }

  let cursor = 0;
  const stops = segments
    .filter((segment) => segment.count > 0)
    .map((segment) => {
      const start = cursor;
      const end = cursor + (segment.count / total) * 100;
      cursor = end;
      return `${segment.color} ${start}% ${end}%`;
    });

  chartEl.style.background = `conic-gradient(${stops.join(", ")})`;
}

function renderChartList(listEl, total, segments) {
  listEl.innerHTML = segments
    .map((segment) => {
      const percent = total ? Math.round((segment.count / total) * 100) : 0;
      return `
        <div>
          <i class="chart-dot" style="background:${segment.color}"></i>
          <span>${escapeHtml(segment.label)}</span>
          <strong>${segment.count} (${percent}%)</strong>
        </div>
      `;
    })
    .join("");
}

function renderPersonnelInsights() {
  const roleSegments = [
    { label: "Police", count: countByType("police"), color: agencyTypeColor("police") },
    { label: "Fire", count: countByType("fire"), color: agencyTypeColor("fire") },
    { label: "EMS", count: countByType("medical"), color: agencyTypeColor("medical") },
    { label: "DRRM", count: countByType("drrm"), color: agencyTypeColor("drrm") },
    { label: "Barangay", count: countByType("barangay"), color: agencyTypeColor("barangay") },
  ];
  const roleTotal = roleSegments.reduce((sum, segment) => sum + segment.count, 0);

  els.totalPersonnelCount.textContent = users.length;
  els.policeCount.textContent = roleSegments[0].count;
  els.fireCount.textContent = roleSegments[1].count;
  els.emsCount.textContent = roleSegments[2].count;
  els.drrmCount.textContent = roleSegments[3].count;
  els.barangayCount.textContent = roleSegments[4].count;
  els.agencyDistributionTotal.textContent = roleTotal;
  renderDonut(els.agencyDistributionChart, roleTotal, roleSegments);
  renderChartList(els.agencyDistributionList, roleTotal, roleSegments);

  const statusSegments = [
    { label: "Available", count: countByStatus("available"), color: "#20d181" },
    { label: "Busy", count: countByStatus("busy"), color: "#ff9f1a" },
    { label: "Responding", count: countByStatus("responding"), color: "#ff415c" },
    { label: "Offline", count: countByStatus("offline"), color: "#8ea2bb" },
  ];
  const statusTotal = statusSegments.reduce((sum, segment) => sum + segment.count, 0);
  els.personnelStatusTotal.textContent = statusTotal;
  renderDonut(els.personnelStatusChart, statusTotal, statusSegments);
  renderChartList(els.personnelStatusList, statusTotal, statusSegments);
}

function renderRecentActivity() {
  if (!statusActivities.length) {
    statusActivities = responders
      .slice()
      .sort((a, b) => new Date(b.lastSeenAt || b.lastLocationUpdate || 0) - new Date(a.lastSeenAt || a.lastLocationUpdate || 0))
      .slice(0, 6)
      .map((responder) => ({
        responderId: getId(responder._id),
        name: responder.name || "-",
        agency: responder.agency?.name || agencyTypeLabel(getAgencyType(responder)) || "N/A",
        status: responder.responderStatus || "offline",
        isOnline: responder.isOnline,
        activityAt: responder.lastSeenAt || responder.lastLocationUpdate,
      }));
  }

  if (!statusActivities.length) {
    els.recentActivityTable.innerHTML = `<tr><td colspan="4" class="empty-state">No recent personnel activity.</td></tr>`;
    return;
  }

  els.recentActivityTable.innerHTML = statusActivities
    .slice(0, 6)
    .map((activity) => {
      const dotClass = statusClass(activity.status, activity.isOnline);
      return `
        <tr>
          <td>${escapeHtml(activity.name)}</td>
          <td>${escapeHtml(activity.agency)}</td>
          <td><span class="status-pill ${dotClass}"><i></i>${escapeHtml(formatLabel(activity.status))}</span></td>
          <td>${escapeHtml(formatLastSeen(activity.activityAt))}</td>
        </tr>
      `;
    })
    .join("");
}

function addStatusActivity(event) {
  if (!event) return;
  const status = event.responderStatus || event.status || "offline";
  const agency = event.agency?.name || agencyTypeLabel(event.agency?.type || event.role) || "N/A";

  statusActivities = [
    {
      responderId: getId(event.responderId),
      name: event.name || "Responder",
      agency,
      status,
      isOnline: event.isOnline,
      activityAt: event.lastSeenAt || new Date().toISOString(),
    },
    ...statusActivities,
  ].slice(0, 12);

  renderRecentActivity();
}

function filterResponders(responderRows) {
  return responderRows.filter((responder) => {
    return (!els.agencyFilter.value || getAgencyType(responder) === els.agencyFilter.value)
      && (!els.stationFilter.value || getId(responder.stationRef) === els.stationFilter.value)
      && (!els.barangayFilter.value || getId(responder.barangayRef) === els.barangayFilter.value);
  });
}

function filteredResponders() {
  return filterResponders(responders).filter((responder) => {
    const status = responder.responderStatus || "offline";
    return !els.statusFilter.value || status === els.statusFilter.value;
  });
}

function renderFilters() {
  const selectedAgency = els.agencyFilter.value;
  const selectedStation = els.stationFilter.value;
  const selectedBarangay = els.barangayFilter.value;
  const agencyTypes = getAgencyFilterTypes();

  els.agencyFilter.innerHTML = `<option value="">All Agencies</option>${agencyTypes
    .map((type) => `<option value="${type}">${escapeHtml(agencyTypeLabel(type))}</option>`)
    .join("")}`;
  els.agencyFilter.value = selectedAgency;

  els.stationFilter.innerHTML = `<option value="">All Stations</option>${getStationOptions()}`;
  els.stationFilter.value = selectedStation;

  els.barangayFilter.innerHTML = `<option value="">All Barangays</option>${getBarangayOptions()}`;
  els.barangayFilter.value = selectedBarangay;
}

function renderStatus() {
  const rows = filteredResponders();
  renderPersonnelInsights();
  renderRecentActivity();
  els.onlineCount.textContent = responders.filter((row) => row.isOnline).length;
  els.availableCount.textContent = countByStatus("available");
  els.busyCount.textContent = countByStatus("busy");
  els.respondingCount.textContent = countByStatus("responding");

  if (!rows.length) {
    els.statusTable.innerHTML = `<tr><td colspan="7" class="empty-state">No responders match the selected filters.</td></tr>`;
    return;
  }

  els.statusTable.innerHTML = rows
    .map((responder) => {
      const status = responder.responderStatus || "offline";
      const dotClass = statusClass(status, responder.isOnline);

      return `
        <tr>
          <td>${escapeHtml(responder.name || "-")}</td>
          <td>${escapeHtml(responder.agency?.name || "N/A")}</td>
          <td>${escapeHtml(responder.stationRef?.name || responder.station || "N/A")}</td>
          <td>${escapeHtml(responder.barangayRef?.name || responder.barangay || "N/A")}</td>
          <td><span class="status-pill ${dotClass}"><i></i>${escapeHtml(formatLabel(status))}</span></td>
          <td><span class="badge ${responder.isOnline ? "badge-active" : "badge-inactive"}">${responder.isOnline ? "Online" : "Offline"}</span></td>
          <td>${escapeHtml(formatLastSeen(responder.lastSeenAt || responder.lastLocationUpdate))}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadStatus() {
  try {
    [responders, users, agencies, stations, barangays] = await Promise.all([
      fetchData("/api/gps/live-responders"),
      fetchData("/api/users"),
      fetchData("/api/agencies"),
      fetchData("/api/stations"),
      fetchData("/api/barangays"),
    ]);
    renderFilters();
    renderStatus();
  } catch (error) {
    els.statusTable.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

els.agencyFilter.addEventListener("change", () => {
  renderFilters();
  renderStatus();
});

[els.statusFilter, els.barangayFilter].forEach((filter) => {
  filter.addEventListener("change", renderStatus);
});

els.stationFilter.addEventListener("change", () => {
  renderFilters();
  renderStatus();
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

updateClock();
setInterval(updateClock, 30000);
loadStatus();
setInterval(loadStatus, 30000);

if (typeof io === "function") {
  const socket = io();
  socket.on("responderStatusUpdated", (event) => {
    addStatusActivity(event);
    loadStatus();
  });
  socket.on("responderLocationUpdated", loadStatus);
}
