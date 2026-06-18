const AGENCY_API_URL = "/api/agencies";
const USER_API_URL = "/api/users";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const canManageAgencies = user.role === "admin";
const canViewAgencies = ["admin", "commander"].includes(user.role);

if (!token || !canViewAgencies) {
  window.location.href = "/login.html";
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
  totalAgencies: document.getElementById("totalAgencies"),
  activeAgencies: document.getElementById("activeAgencies"),
  inactiveAgencies: document.getElementById("inactiveAgencies"),
  assignedPersonnel: document.getElementById("assignedPersonnel"),
  agencySummaryGrid: document.getElementById("agencySummaryGrid"),
  agenciesTable: document.getElementById("agenciesTable"),
  agencySearch: document.getElementById("agencySearch"),
  agencyTypeFilter: document.getElementById("agencyTypeFilter"),
  agencyStatusFilter: document.getElementById("agencyStatusFilter"),
  agencyFormPanel: document.getElementById("agencyFormPanel"),
  agencyForm: document.getElementById("agencyForm"),
  agencyFormTitle: document.getElementById("agencyFormTitle"),
  agencyId: document.getElementById("agencyId"),
  agencyName: document.getElementById("agencyName"),
  agencyType: document.getElementById("agencyType"),
  agencyContactNumber: document.getElementById("agencyContactNumber"),
  agencyAddress: document.getElementById("agencyAddress"),
  agencyStatus: document.getElementById("agencyStatus"),
  agencyMessage: document.getElementById("agencyMessage"),
  cancelAgencyEdit: document.getElementById("cancelAgencyEdit"),
  agencyModal: document.getElementById("agencyModal"),
  closeAgencyModal: document.getElementById("closeAgencyModal"),
  agencyProfileIcon: document.getElementById("agencyProfileIcon"),
  agencyProfileName: document.getElementById("agencyProfileName"),
  agencyProfileSubtitle: document.getElementById("agencyProfileSubtitle"),
  agencyProfileDetails: document.getElementById("agencyProfileDetails"),
  agencyPersonnelList: document.getElementById("agencyPersonnelList"),
};

let agencies = [];
let personnel = [];

if (els.adminName) els.adminName.textContent = user.name || "Admin User";
if (els.adminRole) els.adminRole.textContent = user.rank || user.position || "System Administrator";

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

function agencyLabel(type) {
  if (type === "medical") return "EMS";
  if (type === "drrm") return "DRRM";
  return formatLabel(type);
}

function agencyIcon(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "police") return "fa-shield-halved";
  if (normalized === "fire") return "fa-fire-flame-curved";
  if (normalized === "medical") return "fa-briefcase-medical";
  if (normalized === "drrm") return "fa-hands-holding-circle";
  if (normalized === "barangay") return "fa-people-roof";
  return "fa-building-shield";
}

function statusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("inactive") || normalized.includes("offline")) return "badge-inactive";
  if (normalized.includes("active") || normalized.includes("available")) return "badge-active";
  return "badge-pending";
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

function agencyPersonnel(agency) {
  return personnel.filter((person) => {
    const personAgency = person.agency;
    return personAgency?._id === agency._id || personAgency === agency._id;
  });
}

function personnelByType(type) {
  return personnel.filter((person) => {
    const agencyType = person.agency?.type;
    const role = String(person.role || "").toLowerCase();
    return agencyType === type || role === type;
  });
}

function filteredAgencies() {
  const query = els.agencySearch.value.trim().toLowerCase();
  const type = els.agencyTypeFilter.value;
  const status = els.agencyStatusFilter.value;

  return agencies.filter((agency) => {
    const searchable = [
      agency.name,
      agency.type,
      agency.contactNumber,
      agency.address,
      agency.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (!query || searchable.includes(query))
      && (!type || agency.type === type)
      && (!status || agency.status === status);
  });
}

function renderSummary() {
  const active = agencies.filter((agency) => agency.status !== "inactive").length;
  const inactive = agencies.length - active;
  const assigned = personnel.filter((person) => person.agency?._id || person.agency).length;
  const managedTypes = ["police", "fire", "medical", "drrm", "barangay", "command_center"];

  els.totalAgencies.textContent = agencies.length;
  els.activeAgencies.textContent = active;
  els.inactiveAgencies.textContent = inactive;
  els.assignedPersonnel.textContent = assigned;

  els.agencySummaryGrid.innerHTML = managedTypes
    .map((type) => {
      const agencyCount = agencies.filter((agency) => agency.type === type).length;
      const personnelCount = personnelByType(type).length;

      return `
        <div class="agency-type-card ${type}">
          <i class="fa-solid ${agencyIcon(type)}"></i>
          <div>
            <strong>${escapeHtml(agencyLabel(type))}</strong>
            <span>${agencyCount} agencies</span>
            <b>${personnelCount}</b>
            <em>Personnel</em>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAgencies() {
  const visibleAgencies = filteredAgencies();
  renderSummary();

  if (!visibleAgencies.length) {
    els.agenciesTable.innerHTML = `<tr><td colspan="7" class="empty-state">No agencies found.</td></tr>`;
    return;
  }

  els.agenciesTable.innerHTML = visibleAgencies
    .map((agency) => {
      const assigned = agencyPersonnel(agency).length;

      return `
        <tr>
          <td>
            <button class="table-link" type="button" data-action="view" data-id="${agency._id}">
              ${escapeHtml(agency.name)}
            </button>
            <span class="table-subtext">ID ${escapeHtml(agency._id)}</span>
          </td>
          <td><i class="fa-solid ${agencyIcon(agency.type)}"></i> ${escapeHtml(agencyLabel(agency.type))}</td>
          <td>${escapeHtml(agency.contactNumber || "N/A")}</td>
          <td>${escapeHtml(agency.address || "N/A")}</td>
          <td>${assigned}</td>
          <td><span class="badge ${statusBadge(agency.status)}">${escapeHtml(formatLabel(agency.status || "active"))}</span></td>
          <td>
            <div class="table-actions">
              <button class="ghost-btn compact" type="button" data-action="view" data-id="${agency._id}">View</button>
              ${
                canManageAgencies
                  ? `
                    <button class="ghost-btn compact" type="button" data-action="edit" data-id="${agency._id}">Edit</button>
                    <button class="ghost-btn compact danger" type="button" data-action="delete" data-id="${agency._id}">Delete</button>
                  `
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadAgencies() {
  try {
    const [agencyRows, personnelRows] = await Promise.all([
      fetchData(AGENCY_API_URL),
      fetchData(USER_API_URL),
    ]);

    agencies = agencyRows;
    personnel = personnelRows;
    renderAgencies();
  } catch (error) {
    els.agenciesTable.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function resetAgencyForm() {
  els.agencyForm.reset();
  els.agencyId.value = "";
  els.agencyFormTitle.textContent = "Add Agency";
  els.agencyMessage.className = "message";
  els.agencyMessage.textContent = "";
}

function editAgency(agency) {
  els.agencyId.value = agency._id;
  els.agencyName.value = agency.name || "";
  els.agencyType.value = agency.type || "";
  els.agencyContactNumber.value = agency.contactNumber || "";
  els.agencyAddress.value = agency.address || "";
  els.agencyStatus.value = agency.status || "active";
  els.agencyFormTitle.textContent = "Edit Agency";
  els.agencyMessage.className = "message";
  els.agencyMessage.textContent = "";
  els.agencyFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openAgencyProfile(agency) {
  const assigned = agencyPersonnel(agency);
  els.agencyProfileIcon.innerHTML = `<i class="fa-solid ${agencyIcon(agency.type)}"></i>`;
  els.agencyProfileName.textContent = agency.name || "Agency Profile";
  els.agencyProfileSubtitle.textContent = `${agencyLabel(agency.type)} - ${formatLabel(agency.status || "active")}`;
  els.agencyProfileDetails.innerHTML = [
    ["Agency ID", agency._id],
    ["Type", agencyLabel(agency.type)],
    ["Status", formatLabel(agency.status || "active")],
    ["Contact", agency.contactNumber || "N/A"],
    ["Address", agency.address || "N/A"],
    ["Assigned Personnel", assigned.length],
  ]
    .map(([label, value]) => `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `)
    .join("");

  els.agencyPersonnelList.innerHTML = assigned.length
    ? assigned.map((person) => `
        <div>
          <strong>${escapeHtml(person.name || "Unnamed Personnel")}</strong>
          <span>${escapeHtml(formatLabel(person.role))} | ${escapeHtml(person.unit || person.station || "No unit")}</span>
        </div>
      `).join("")
    : `<div><strong>No personnel assigned</strong><span>Assign personnel from the Users page.</span></div>`;

  els.agencyModal.hidden = false;
}

function closeAgencyProfile() {
  els.agencyModal.hidden = true;
}

if (!canManageAgencies) {
  els.agencyFormPanel.remove();
}

els.agencyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageAgencies) return;

  const id = els.agencyId.value;
  const body = {
    name: els.agencyName.value.trim(),
    type: els.agencyType.value,
    contactNumber: els.agencyContactNumber.value.trim(),
    address: els.agencyAddress.value.trim(),
    status: els.agencyStatus.value,
  };

  try {
    const response = await fetch(id ? `${AGENCY_API_URL}/${id}` : AGENCY_API_URL, {
      method: id ? "PUT" : "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to save agency");
    }

    resetAgencyForm();
    els.agencyMessage.className = "message success";
    els.agencyMessage.textContent = data.message || "Agency saved successfully.";
    loadAgencies();
  } catch (error) {
    els.agencyMessage.className = "message error";
    els.agencyMessage.textContent = error.message;
  }
});

els.agenciesTable.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const agency = agencies.find((item) => item._id === actionButton.dataset.id);
  if (!agency) return;

  if (actionButton.dataset.action === "view") {
    openAgencyProfile(agency);
  }

  if (actionButton.dataset.action === "edit" && canManageAgencies) {
    editAgency(agency);
  }

  if (actionButton.dataset.action === "delete" && canManageAgencies) {
    if (!confirm(`Delete ${agency.name}?`)) return;

    try {
      const response = await fetch(`${AGENCY_API_URL}/${agency._id}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete agency");
      }

      loadAgencies();
    } catch (error) {
      alert(error.message);
    }
  }
});

[els.agencySearch, els.agencyTypeFilter, els.agencyStatusFilter].forEach((filter) => {
  filter.addEventListener("input", renderAgencies);
  filter.addEventListener("change", renderAgencies);
});

els.cancelAgencyEdit.addEventListener("click", resetAgencyForm);
els.closeAgencyModal.addEventListener("click", closeAgencyProfile);
els.agencyModal.addEventListener("click", (event) => {
  if (event.target === els.agencyModal) closeAgencyProfile();
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

updateClock();
setInterval(updateClock, 30000);
loadAgencies();
