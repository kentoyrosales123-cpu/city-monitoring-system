const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const responderRoles = ["responder", "police", "fire", "medical", "drrm", "barangay"];

if (!token || !["admin", "commander"].includes(user.role)) {
  const target = token && responderRoles.includes(user.role) ? "/responder-dashboard.html" : "/login.html";
  window.location.replace(target);
  throw new Error("Monitoring page is restricted to admin and commander accounts");
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
  trackedCount: document.getElementById("trackedCount"),
  onlineCount: document.getElementById("onlineCount"),
  incidentCount: document.getElementById("incidentCount"),
  respondingCount: document.getElementById("respondingCount"),
  agencyFilter: document.getElementById("agencyFilter"),
  stationFilter: document.getElementById("stationFilter"),
  barangayFilter: document.getElementById("barangayFilter"),
  statusFilter: document.getElementById("statusFilter"),
  mapPins: document.getElementById("mapPins"),
  monitoringTable: document.getElementById("monitoringTable"),
  refreshBtn: document.getElementById("refreshBtn"),
};

let responders = [];
let incidents = [];
let agencies = [];
let stations = [];
let barangays = [];

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

function getId(value) {
  if (!value) return "";
  return typeof value === "string" ? value : value._id || "";
}

function getAgencyName(responder) {
  return responder.agency?.name || responder.agency || "N/A";
}

function agencyTypeLabel(type) {
  if (type === "medical") return "EMS";
  if (type === "drrm") return "DRRM";
  return formatLabel(type);
}

function getAgencyType(responder) {
  return responder.agency?.type || responder.role || "";
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

function getStationName(responder) {
  return responder.stationRef?.name || responder.station || "N/A";
}

function getBarangayName(responder) {
  return responder.barangayRef?.name || responder.barangay || "N/A";
}

function getResponderStatus(responder) {
  return responder.responderStatus || "offline";
}

function statusClass(status, isOnline) {
  if (!isOnline || status === "offline") return "unit";
  if (status === "available") return "low";
  if (status === "busy") return "medium";
  if (status === "responding") return "high";
  return "unit";
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

function hasCoordinates(item) {
  return Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
}

function mapPoint(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const x = 12 + Math.abs(lng * 7.31 + lat * 3.17) % 76;
  const y = 12 + Math.abs(lat * 6.23 - lng * 2.79) % 72;
  return { x, y };
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

function filteredResponders() {
  return responders.filter((responder) => {
    const status = getResponderStatus(responder);
    return (!els.agencyFilter.value || getAgencyType(responder) === els.agencyFilter.value)
      && (!els.stationFilter.value || getId(responder.stationRef) === els.stationFilter.value)
      && (!els.barangayFilter.value || getId(responder.barangayRef) === els.barangayFilter.value)
      && (!els.statusFilter.value || status === els.statusFilter.value);
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

function renderSummary() {
  const visibleResponders = filteredResponders();
  els.trackedCount.textContent = visibleResponders.filter(hasCoordinates).length;
  els.onlineCount.textContent = visibleResponders.filter((responder) => responder.isOnline).length;
  els.incidentCount.textContent = incidents.length;
  els.respondingCount.textContent = visibleResponders.filter((responder) => getResponderStatus(responder) === "responding").length;
}

function renderMap() {
  const responderPins = filteredResponders()
    .filter(hasCoordinates)
    .map((responder) => {
      const point = mapPoint(responder.latitude, responder.longitude);
      const status = getResponderStatus(responder);
      return `
        <span class="map-pin ${statusClass(status, responder.isOnline)}" style="--x:${point.x}%;--y:${point.y}%" title="${escapeHtml(responder.name || "Responder")}">
          <i class="fa-solid fa-location-crosshairs"></i>
        </span>
      `;
    });

  const incidentPins = incidents
    .filter(hasCoordinates)
    .slice(0, 12)
    .map((incident) => {
      const point = mapPoint(incident.latitude, incident.longitude);
      return `
        <span class="map-pin critical" style="--x:${point.x}%;--y:${point.y}%" title="${escapeHtml(incident.title || "Incident")}">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </span>
      `;
    });

  els.mapPins.innerHTML = responderPins.concat(incidentPins).join("")
    || `<div class="empty-state">No tracked responders or incidents with coordinates yet.</div>`;
}

function renderTable() {
  const rows = filteredResponders();

  if (!rows.length) {
    els.monitoringTable.innerHTML = `<tr><td colspan="7">No responders match the selected monitoring filters.</td></tr>`;
    return;
  }

  els.monitoringTable.innerHTML = rows
    .map((responder) => {
      const status = getResponderStatus(responder);
      const coordinates = hasCoordinates(responder)
        ? `${Number(responder.latitude).toFixed(5)}, ${Number(responder.longitude).toFixed(5)}`
        : "No GPS fix";

      return `
        <tr>
          <td>${escapeHtml(responder.name || "-")}</td>
          <td>${escapeHtml(getAgencyName(responder))}</td>
          <td>${escapeHtml(getStationName(responder))}</td>
          <td>${escapeHtml(getBarangayName(responder))}</td>
          <td><span class="badge ${responder.isOnline ? "badge-active" : "badge-inactive"}">${escapeHtml(formatLabel(status))}</span></td>
          <td>${escapeHtml(coordinates)}</td>
          <td>${escapeHtml(formatLastSeen(responder.lastSeenAt || responder.lastLocationUpdate))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMonitoring() {
  renderFilters();
  renderSummary();
  renderMap();
  renderTable();
}

async function loadMonitoring() {
  try {
    const [responderRows, incidentRows, agencyRows, stationRows, barangayRows] = await Promise.all([
      fetchData("/api/gps/live-responders"),
      fetchData("/api/incidents"),
      fetchData("/api/agencies"),
      fetchData("/api/stations"),
      fetchData("/api/barangays"),
    ]);

    responders = responderRows;
    incidents = incidentRows;
    agencies = agencyRows;
    stations = stationRows;
    barangays = barangayRows;
    renderMonitoring();
  } catch (error) {
    els.monitoringTable.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
  }
}

els.agencyFilter.addEventListener("change", () => {
  renderFilters();
  renderSummary();
  renderMap();
  renderTable();
});

[els.barangayFilter, els.statusFilter].forEach((filter) => {
  filter.addEventListener("change", () => {
    renderSummary();
    renderMap();
    renderTable();
  });
});

els.stationFilter.addEventListener("change", () => {
  renderFilters();
  renderSummary();
  renderMap();
  renderTable();
});

els.refreshBtn.addEventListener("click", loadMonitoring);

els.logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

updateClock();
setInterval(updateClock, 30000);
loadMonitoring();
setInterval(loadMonitoring, 30000);

if (typeof io === "function") {
  const socket = io();
  socket.on("responderStatusUpdated", loadMonitoring);
  socket.on("responderLocationUpdated", loadMonitoring);
}
