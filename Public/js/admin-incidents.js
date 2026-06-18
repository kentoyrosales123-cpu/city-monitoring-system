const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const canViewIncidents = ["admin", "commander"].includes(user.role);
const canManageIncidents = ["admin", "commander"].includes(user.role);

if (!token || !canViewIncidents) {
  window.location.replace("/login.html");
  throw new Error("Admin or commander account required");
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
  totalIncidents: document.getElementById("totalIncidents"),
  activeIncidents: document.getElementById("activeIncidents"),
  criticalIncidents: document.getElementById("criticalIncidents"),
  resolvedIncidents: document.getElementById("resolvedIncidents"),
  incidentSearch: document.getElementById("incidentSearch"),
  typeFilter: document.getElementById("typeFilter"),
  statusFilter: document.getElementById("statusFilter"),
  severityFilter: document.getElementById("severityFilter"),
  sortControl: document.getElementById("sortControl"),
  categoryChart: document.getElementById("categoryChart"),
  categoryChartTotal: document.getElementById("categoryChartTotal"),
  categoryChartList: document.getElementById("categoryChartList"),
  statusChart: document.getElementById("statusChart"),
  statusChartTotal: document.getElementById("statusChartTotal"),
  statusChartList: document.getElementById("statusChartList"),
  severityChartList: document.getElementById("severityChartList"),
  trendChartList: document.getElementById("trendChartList"),
  incidentsTable: document.getElementById("incidentsTable"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  incidentModal: document.getElementById("incidentModal"),
  closeIncidentModal: document.getElementById("closeIncidentModal"),
  incidentModalTitle: document.getElementById("incidentModalTitle"),
  incidentModalSubtitle: document.getElementById("incidentModalSubtitle"),
  incidentDetails: document.getElementById("incidentDetails"),
  incidentAssignmentPanel: document.getElementById("incidentAssignmentPanel"),
  incidentAssignmentHistory: document.getElementById("incidentAssignmentHistory"),
  incidentMedia: document.getElementById("incidentMedia"),
  incidentTimeline: document.getElementById("incidentTimeline"),
};

let incidents = [];
let agencies = [];
let responders = [];
let currentPage = 1;
const pageSize = 10;
const severityRank = { low: 1, moderate: 2, medium: 2, high: 3, critical: 4 };
const responderRoles = ["responder", "police", "fire", "medical", "drrm", "barangay"];

els.adminName.textContent = user.name || "Admin User";
els.adminRole.textContent = user.rank || user.position || "System Administrator";

function updateClock() {
  const now = new Date();
  els.currentDate.textContent = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  els.currentTime.textContent = `${now.toLocaleDateString("en-US", { weekday: "long" })}, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function incidentType(incident) {
  return incident.incidentSubtype || incident.type || "general_incident";
}

function incidentNumber(incident) {
  return incident.incidentId || incident.incidentNumber || incident._id || "-";
}

function incidentLocation(incident) {
  return incident.address || incident.barangay || "Unspecified";
}

function assignedAgencyName(incident) {
  return incident.assignedAgency?.name || "Unassigned";
}

function isActive(incident) {
  return !["resolved", "closed", "cancelled"].includes(String(incident.status || "").toLowerCase());
}

function nextWorkflowStatus(status) {
  const flow = {
    reported: "verified",
    verified: "assigned",
    assigned: "responding",
    responding: "resolved",
    resolved: "closed",
  };
  return flow[status] || "";
}

function badgeClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "critical" || normalized === "cancelled") return "badge-critical";
  if (normalized === "high" || normalized === "responding") return "badge-high";
  if (normalized === "resolved" || normalized === "verified") return "badge-active";
  if (normalized === "reported" || normalized === "assigned") return "badge-pending";
  return "badge-medium";
}

async function fetchIncidents() {
  const response = await fetch("/api/incidents", { headers });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return [];
    }
    throw new Error(data.message || "Unable to load incidents");
  }

  return Array.isArray(data) ? data : [];
}

async function fetchData(url) {
  const response = await fetch(url, { headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Unable to load ${url}`);
  return Array.isArray(data) ? data : [];
}

function uniqueOptions(rows, getter) {
  return Array.from(new Set(rows.map(getter).filter(Boolean)))
    .sort()
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(formatLabel(value))}</option>`)
    .join("");
}

function renderFilters() {
  const selectedType = els.typeFilter.value;
  const selectedStatus = els.statusFilter.value;
  const selectedSeverity = els.severityFilter.value;
  els.typeFilter.innerHTML = `<option value="">All Types</option>${uniqueOptions(incidents, incidentType)}`;
  els.statusFilter.innerHTML = `<option value="">All Statuses</option>${uniqueOptions(incidents, (incident) => incident.status)}`;
  els.severityFilter.innerHTML = `<option value="">All Severity</option>${uniqueOptions(incidents, (incident) => incident.severity)}`;
  els.typeFilter.value = selectedType;
  els.statusFilter.value = selectedStatus;
  els.severityFilter.value = selectedSeverity;
}

function filteredIncidents() {
  const query = els.incidentSearch.value.trim().toLowerCase();
  const rows = incidents.filter((incident) => {
    const haystack = [
      incidentNumber(incident),
      incident.title,
      incidentType(incident),
      incidentLocation(incident),
      incident.reportedBy?.name,
      incident.status,
      incident.severity,
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (!els.typeFilter.value || incidentType(incident) === els.typeFilter.value)
      && (!els.statusFilter.value || incident.status === els.statusFilter.value)
      && (!els.severityFilter.value || incident.severity === els.severityFilter.value);
  });

  return rows.sort((a, b) => {
    if (els.sortControl.value === "date_asc") {
      return new Date(a.reportedAt || a.createdAt) - new Date(b.reportedAt || b.createdAt);
    }
    if (els.sortControl.value === "severity_desc") {
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    }
    if (els.sortControl.value === "severity_asc") {
      return (severityRank[a.severity] || 0) - (severityRank[b.severity] || 0);
    }
    return new Date(b.reportedAt || b.createdAt) - new Date(a.reportedAt || a.createdAt);
  });
}

function renderSummary() {
  els.totalIncidents.textContent = incidents.length;
  els.activeIncidents.textContent = incidents.filter(isActive).length;
  els.criticalIncidents.textContent = incidents.filter((incident) => incident.severity === "critical").length;
  els.resolvedIncidents.textContent = incidents.filter((incident) => incident.status === "resolved").length;
}

function countBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = getter(row) || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function colorFor(index) {
  return ["#2f9cf4", "#20d181", "#ff9f1a", "#ff415c", "#a77cff", "#8ea2bb"][index % 6];
}

function renderDonut(chartEl, total, entries) {
  if (!total) {
    chartEl.style.background = "conic-gradient(rgba(129, 165, 205, 0.16) 0 100%)";
    return;
  }
  let cursor = 0;
  chartEl.style.background = `conic-gradient(${entries.map((entry, index) => {
    const start = cursor;
    const end = cursor + (entry[1] / total) * 100;
    cursor = end;
    return `${colorFor(index)} ${start}% ${end}%`;
  }).join(", ")})`;
}

function renderList(listEl, entries, total) {
  listEl.innerHTML = entries.map(([label, count], index) => {
    const percent = total ? Math.round((count / total) * 100) : 0;
    return `<div><i class="chart-dot" style="background:${colorFor(index)}"></i><span>${escapeHtml(formatLabel(label))}</span><strong>${count} (${percent}%)</strong></div>`;
  }).join("");
}

function renderCharts() {
  const categoryEntries = Object.entries(countBy(incidents, (incident) => incident.type));
  const statusEntries = Object.entries(countBy(incidents, (incident) => incident.status));
  const severityEntries = Object.entries(countBy(incidents, (incident) => incident.severity))
    .sort((a, b) => (severityRank[b[0]] || 0) - (severityRank[a[0]] || 0));
  const trendEntries = Object.entries(countBy(incidents, (incident) => {
    const date = new Date(incident.reportedAt || incident.createdAt);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })).slice(-7);
  const total = incidents.length;

  els.categoryChartTotal.textContent = total;
  els.statusChartTotal.textContent = total;
  renderDonut(els.categoryChart, total, categoryEntries);
  renderDonut(els.statusChart, total, statusEntries);
  renderList(els.categoryChartList, categoryEntries, total);
  renderList(els.statusChartList, statusEntries, total);
  renderList(els.severityChartList, severityEntries, total);
  renderList(els.trendChartList, trendEntries, total);
}

function renderTable() {
  const rows = filteredIncidents();
  if (!rows.length) {
    els.incidentsTable.innerHTML = `<tr><td colspan="9" class="empty-state">No incidents match the selected filters.</td></tr>`;
    els.pageInfo.textContent = "Page 0 of 0";
    return;
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  els.incidentsTable.innerHTML = pageRows.map((incident) => `
    <tr>
      <td><button class="table-link" type="button" data-action="view" data-id="${incident._id}">${escapeHtml(incidentNumber(incident))}</button></td>
      <td>${escapeHtml(formatLabel(incidentType(incident)))}</td>
      <td>${escapeHtml(incidentLocation(incident))}</td>
      <td>${escapeHtml(incident.barangay || "N/A")}</td>
      <td>${escapeHtml(assignedAgencyName(incident))}</td>
      <td><span class="badge ${badgeClass(incident.severity)}">${escapeHtml(formatLabel(incident.severity))}</span></td>
      <td><span class="badge ${badgeClass(incident.status)}">${escapeHtml(formatLabel(incident.status))}</span></td>
      <td>${escapeHtml(formatDate(incident.reportedAt || incident.createdAt))}</td>
      <td>
        <div class="table-actions">
          <button class="ghost-btn compact" type="button" data-action="view" data-id="${incident._id}">View</button>
          ${canManageIncidents ? `<button class="ghost-btn compact" type="button" data-action="edit" data-id="${incident._id}">Edit</button>` : ""}
          ${canManageIncidents ? `<button class="ghost-btn compact" type="button" data-action="assign" data-id="${incident._id}">Assign</button>` : ""}
          ${canManageIncidents && nextWorkflowStatus(incident.status) ? `<button class="ghost-btn compact" type="button" data-action="status" data-status="${nextWorkflowStatus(incident.status)}" data-id="${incident._id}">${escapeHtml(formatLabel(nextWorkflowStatus(incident.status)))}</button>` : ""}
          ${user.role === "admin" ? `<button class="ghost-btn compact danger" type="button" data-action="delete" data-id="${incident._id}">Delete</button>` : ""}
        </div>
      </td>
    </tr>
  `).join("");
  els.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  els.prevPageBtn.disabled = currentPage <= 1;
  els.nextPageBtn.disabled = currentPage >= totalPages;
}

function renderIncidents() {
  renderSummary();
  renderCharts();
  renderFilters();
  renderTable();
}

function showIncident(incident) {
  els.incidentModalTitle.textContent = incidentNumber(incident);
  els.incidentModalSubtitle.textContent = `${formatLabel(incidentType(incident))} - ${formatLabel(incident.status)}`;
  const coordinates = incident.latitude !== undefined && incident.longitude !== undefined
    ? `${incident.latitude}, ${incident.longitude}`
    : "N/A";
  const details = [
    ["Title", incident.title],
    ["Type", formatLabel(incidentType(incident))],
    ["Severity", formatLabel(incident.severity)],
    ["Status", formatLabel(incident.status)],
    ["Address", incidentLocation(incident)],
    ["Coordinates", coordinates],
    ["Reporter", incident.reportedBy?.name || "N/A"],
    ["Assigned Agency", incident.assignedAgency?.name || "N/A"],
    ["Assigned Responders", incident.assignedResponders?.map((person) => person.name).join(", ") || "N/A"],
    ["Reported", formatDate(incident.reportedAt || incident.createdAt)],
    ["Resolved", formatDate(incident.resolvedAt)],
    ["Closed", formatDate(incident.closedAt)],
    ["Resolution Notes", incident.resolutionNotes || "N/A"],
    ["Resolution Report", incident.resolutionReport || "N/A"],
    ["Description", incident.description || "N/A"],
  ];
  els.incidentDetails.innerHTML = details.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  els.incidentMedia.innerHTML = `
    <div><strong>Incident Photos</strong><span>${incident.photos?.length ? `${incident.photos.length} attached` : "No photos attached"}</span></div>
    <div><strong>Evidence Files</strong><span>${incident.evidence?.length ? `${incident.evidence.length} attached` : "No evidence attached"}</span></div>
    <div><strong>Resolution Evidence</strong><span>${incident.resolutionEvidence?.length ? `${incident.resolutionEvidence.length} attached` : "No resolution evidence"}</span></div>
  `;
  els.incidentAssignmentPanel.innerHTML = `
    <div class="mini-form">
      <h3>Assigned Agency</h3>
      <select id="modalAgencySelect">
        <option value="">Unassigned</option>
        ${agencies.map((agency) => `<option value="${agency._id}" ${agency._id === incident.assignedAgency?._id ? "selected" : ""}>${escapeHtml(agency.name)}</option>`).join("")}
      </select>
    </div>
    <div class="mini-form">
      <h3>Assigned Responders</h3>
      <select id="modalResponderSelect" multiple size="5">
        ${responders.map((responder) => `<option value="${responder._id}" ${incident.assignedResponders?.some((person) => person._id === responder._id) ? "selected" : ""}>${escapeHtml(responder.name)} - ${escapeHtml(formatLabel(responder.role))}</option>`).join("")}
      </select>
    </div>
    <div class="mini-form">
      <h3>Assignment Action</h3>
      <button class="btn-primary" type="button" data-modal-action="save-assignment" data-id="${incident._id}">Save Assignment</button>
    </div>
  `;
  els.incidentTimeline.innerHTML = incident.timeline?.length
    ? incident.timeline.slice().reverse().map((item) => `<div><strong>${escapeHtml(formatLabel(item.status))}</strong><span>${escapeHtml(item.note || "Status updated")} - ${escapeHtml(formatDate(item.changedAt))}</span></div>`).join("")
    : `<div><strong>No timeline yet</strong><span>Timeline entries will appear as statuses change.</span></div>`;
  els.incidentAssignmentHistory.innerHTML = incident.assignmentHistory?.length
    ? incident.assignmentHistory.slice().reverse().map((item) => {
      const agency = item.nextAgency?.name || "Unassigned";
      const responderNames = item.nextResponders?.map((person) => person.name).join(", ") || "No responders";
      const assignedBy = item.assignedBy?.name || "System";
      return `<div><strong>${escapeHtml(formatLabel(item.action))}</strong><span>${escapeHtml(agency)} - ${escapeHtml(responderNames)} - ${escapeHtml(formatDate(item.assignedAt))} by ${escapeHtml(assignedBy)}</span></div>`;
    }).join("")
    : `<div><strong>No assignment history yet</strong><span>Agency and responder assignment changes will appear here.</span></div>`;
  els.incidentModal.hidden = false;
}

async function updateIncident(id, payload) {
  const response = await fetch(`/api/incidents/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to update incident");
  await loadIncidents();
}

async function assignIncident(id) {
  const selectedResponders = Array.from(document.getElementById("modalResponderSelect")?.selectedOptions || []).map((option) => option.value);
  const assignedAgency = document.getElementById("modalAgencySelect")?.value || null;
  const response = await fetch(`/api/incidents/${id}/assign`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ assignedAgency, assignedResponders: selectedResponders }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to assign incident");
  els.incidentModal.hidden = true;
  await loadIncidents();
}

async function updateIncidentStatus(id, status) {
  const payload = { status };
  if (status === "resolved") {
    payload.resolutionNotes = prompt("Resolution notes") || "";
    payload.resolutionReport = prompt("Resolution report") || "";
    const evidence = prompt("Resolution evidence URLs or references, comma separated") || "";
    payload.resolutionEvidence = evidence
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const response = await fetch(`/api/incidents/${id}/status`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to update incident");
  await loadIncidents();
}

async function loadIncidents() {
  try {
    [incidents, agencies, responders] = await Promise.all([
      fetchIncidents(),
      fetchData("/api/agencies"),
      fetchData("/api/users").then((rows) => rows.filter((person) => responderRoles.includes(person.role))),
    ]);
    renderIncidents();
  } catch (error) {
    els.incidentsTable.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

[els.incidentSearch, els.typeFilter, els.statusFilter, els.severityFilter].forEach((filter) => {
  filter.addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });
  filter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });
});

els.sortControl.addEventListener("change", () => {
  currentPage = 1;
  renderTable();
});

els.prevPageBtn.addEventListener("click", () => {
  currentPage -= 1;
  renderTable();
});

els.nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  renderTable();
});

els.incidentsTable.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const incident = incidents.find((row) => row._id === button.dataset.id);
  if (!incident) return;

  if (button.dataset.action === "view") {
    showIncident(incident);
    return;
  }

  if (button.dataset.action === "edit") {
    try {
      await updateIncident(incident._id, {
        title: prompt("Incident title", incident.title || "") || incident.title,
        type: incident.type,
        incidentSubtype: incident.incidentSubtype,
        description: prompt("Description", incident.description || "") || incident.description,
        address: prompt("Address", incident.address || "") || incident.address,
        latitude: incident.latitude,
        longitude: incident.longitude,
        barangay: incident.barangay,
        severity: prompt("Severity: low, moderate, high, critical", incident.severity || "moderate") || incident.severity,
        photos: incident.photos || [],
        evidence: incident.evidence || [],
        assignedAgency: incident.assignedAgency?._id || incident.assignedAgency || null,
        assignedResponders: incident.assignedResponders?.map((person) => person._id || person) || [],
      });
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  if (button.dataset.action === "assign") {
    showIncident(incident);
    return;
  }

  if (button.dataset.action === "status") {
    try {
      await updateIncidentStatus(incident._id, button.dataset.status);
    } catch (error) {
      alert(error.message);
    }
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete ${incidentNumber(incident)}?`)) return;
    try {
      const response = await fetch(`/api/incidents/${incident._id}`, { method: "DELETE", headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete incident");
      await loadIncidents();
    } catch (error) {
      alert(error.message);
    }
  }
});

els.incidentModal.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-modal-action]");
  if (!button) return;
  if (button.dataset.modalAction === "save-assignment") {
    try {
      await assignIncident(button.dataset.id);
    } catch (error) {
      alert(error.message);
    }
  }
});

els.closeIncidentModal.addEventListener("click", () => {
  els.incidentModal.hidden = true;
});

els.incidentModal.addEventListener("click", (event) => {
  if (event.target === els.incidentModal) {
    els.incidentModal.hidden = true;
  }
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

updateClock();
setInterval(updateClock, 30000);
loadIncidents();

if (typeof io === "function") {
  const socket = io();
  socket.on("incidentCreated", loadIncidents);
  socket.on("incidentStatusUpdated", loadIncidents);
  socket.on("incidentAssigned", loadIncidents);
  socket.on("incidentReassigned", loadIncidents);
}
