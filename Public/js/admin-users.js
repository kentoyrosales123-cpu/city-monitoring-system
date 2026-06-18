const API_URL = "/api/users";
const AGENCY_API_URL = "/api/agencies";
const STATION_API_URL = "/api/stations";
const BARANGAY_API_URL = "/api/barangays";
const ASSIGNMENT_API_URL = "/api/assignments";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const canManagePersonnel = user.role === "admin";
const canViewPersonnel = ["admin", "commander"].includes(user.role);

if (!token || !canViewPersonnel) {
  window.location.href = "/login.html";
}

const form = document.getElementById("personnelForm");
const table = document.getElementById("personnelTable");
const fields = {
  userId: document.getElementById("userId"),
  name: document.getElementById("name"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  role: document.getElementById("role"),
  agency: document.getElementById("agency"),
  rank: document.getElementById("rank"),
  unit: document.getElementById("unit"),
  station: document.getElementById("station"),
  barangay: document.getElementById("barangay"),
  accountStatus: document.getElementById("accountStatus"),
  responderStatus: document.getElementById("responderStatus"),
};
const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const logoutBtn = document.getElementById("logoutBtn");
const currentDate = document.getElementById("currentDate");
const currentTime = document.getElementById("currentTime");
const personnelSearch = document.getElementById("personnelSearch");
const photoInput = document.getElementById("photo");
const profileEntrypoints = document.querySelectorAll(".profile-row, .top-avatar");
const profileModal = document.getElementById("profileModal");
const closeProfileModal = document.getElementById("closeProfileModal");
const profilePhoto = document.getElementById("profilePhoto");
const profileName = document.getElementById("profileName");
const profileSubtitle = document.getElementById("profileSubtitle");
const profileDetails = document.getElementById("profileDetails");
const assignmentHistoryList = document.getElementById("assignmentHistoryList");
const stationForm = document.getElementById("stationForm");
const barangayForm = document.getElementById("barangayForm");
const bulkAssignmentForm = document.getElementById("bulkAssignmentForm");
const assignmentFields = {
  stationName: document.getElementById("stationName"),
  stationAgency: document.getElementById("stationAgency"),
  stationType: document.getElementById("stationType"),
  barangayName: document.getElementById("barangayName"),
  barangayDistrict: document.getElementById("barangayDistrict"),
  barangayContactNumber: document.getElementById("barangayContactNumber"),
  bulkAgency: document.getElementById("bulkAgency"),
  bulkStation: document.getElementById("bulkStation"),
  bulkBarangay: document.getElementById("bulkBarangay"),
};
let personnel = [];
let agencies = [];
let stations = [];
let barangays = [];
let assignmentHistory = [];
let selectedPhotoData = "";

if (adminName) {
  adminName.textContent = user.name || "Admin User";
}

if (adminRole) {
  adminRole.textContent = user.rank || user.position || "System Administrator";
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });
}

function updateClock() {
  if (!currentDate || !currentTime) return;

  const now = new Date();
  currentDate.textContent = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  currentTime.textContent = `${now.toLocaleDateString("en-US", {
    weekday: "long",
  })}, ${now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatLabel(value) {
  return String(value || "-")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeAgencyId(value) {
  const trimmed = String(value || "").trim();
  return /^[a-f\d]{24}$/i.test(trimmed) ? trimmed : null;
}

function optionList(items, selectedValue = "", labelGetter = (item) => item.name) {
  return items
    .map((item) => `
      <option value="${item._id}" ${item._id === selectedValue ? "selected" : ""}>
        ${escapeHtml(labelGetter(item))}
      </option>
    `)
    .join("");
}

function populateAssignmentOptions() {
  const agencyOptions = `<option value="">Select Agency</option>${optionList(agencies, fields.agency.value, (agency) => agency.name)}`;
  const stationOptions = `<option value="">Select Station</option>${optionList(stations, fields.station.value, (station) => station.name)}`;
  const barangayOptions = `<option value="">Select Barangay</option>${optionList(barangays, fields.barangay.value, (barangay) => barangay.name)}`;

  fields.agency.innerHTML = agencyOptions;
  fields.station.innerHTML = stationOptions;
  fields.barangay.innerHTML = barangayOptions;
  assignmentFields.stationAgency.innerHTML = `<option value="">Linked Agency</option>${optionList(agencies)}`;
  assignmentFields.bulkAgency.innerHTML = `<option value="">Assign Agency</option>${optionList(agencies)}`;
  assignmentFields.bulkStation.innerHTML = `<option value="">Assign Station</option>${optionList(stations)}`;
  assignmentFields.bulkBarangay.innerHTML = `<option value="">Assign Barangay</option>${optionList(barangays)}`;
}

function getRecordId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id || "";
}

function agencyName(user) {
  if (user.agency?.name) return user.agency.name;
  const agencyId = getRecordId(user.agency);
  return agencies.find((agency) => agency._id === agencyId)?.name || "N/A";
}

function stationName(user) {
  if (user.stationRef?.name) return user.stationRef.name;
  const stationId = getRecordId(user.stationRef);
  return stations.find((station) => station._id === stationId)?.name || user.station || "N/A";
}

function barangayName(user) {
  if (user.barangayRef?.name) return user.barangayRef.name;
  const barangayId = getRecordId(user.barangayRef);
  return barangays.find((barangay) => barangay._id === barangayId)?.name || user.barangay || "N/A";
}

function statusBadge(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("inactive") || normalized.includes("offline")) return "badge-inactive";
  if (normalized.includes("active") || normalized.includes("available")) return "badge-active";
  if (normalized.includes("responding") || normalized.includes("busy")) return "badge-ongoing";
  return "badge-pending";
}

function renderPhoto(user) {
  if (user.photo) {
    return `<img src="${escapeHtml(user.photo)}" alt="${escapeHtml(user.name || "Personnel")} photo" />`;
  }

  return `<i class="fa-solid fa-user"></i>`;
}

function personnelMatchesSearch(user, query) {
  if (!query) return true;

  const searchable = [
    user.name,
    user.email,
    user.role,
    agencyName(user),
    stationName(user),
    barangayName(user),
    user.unit,
    user.rank,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

function renderPersonnel() {
  const query = (personnelSearch?.value || "").trim().toLowerCase();
  const visiblePersonnel = personnel.filter((user) => personnelMatchesSearch(user, query));

  if (!visiblePersonnel.length) {
    table.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">No personnel records found.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = visiblePersonnel
    .map((user) => {
      const accountStatusValue = user.accountStatus || "active";
      const nextAccountStatus = accountStatusValue === "active" ? "inactive" : "active";

      return `
        <tr>
          <td><input class="row-check" type="checkbox" value="${user._id}" aria-label="Select ${escapeHtml(user.name || "personnel")}" /></td>
          <td><div class="profile-photo">${renderPhoto(user)}</div></td>
          <td>
            <button class="table-link" type="button" data-action="profile" data-id="${user._id}">
              ${escapeHtml(user.name || "-")}
            </button>
          </td>
          <td>${escapeHtml(formatLabel(user.role))}</td>
          <td>${escapeHtml(agencyName(user))}</td>
          <td>${escapeHtml(stationName(user))}</td>
          <td>${escapeHtml(barangayName(user))}</td>
          <td><span class="badge ${statusBadge(accountStatusValue)}">${escapeHtml(formatLabel(accountStatusValue))}</span></td>
          <td><span class="badge ${statusBadge(user.responderStatus || "offline")}">${escapeHtml(formatLabel(user.responderStatus || "offline"))}</span></td>
          <td>
            <div class="table-actions">
              <button class="ghost-btn compact" type="button" data-action="profile" data-id="${user._id}">View</button>
              ${
                canManagePersonnel
                  ? `
                    <button class="ghost-btn compact" type="button" data-action="edit" data-id="${user._id}">Edit</button>
                    <button class="ghost-btn compact" type="button" data-action="toggle-status" data-status="${nextAccountStatus}" data-id="${user._id}">
                      ${accountStatusValue === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button class="ghost-btn compact danger" type="button" data-action="delete" data-id="${user._id}">Delete</button>
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

async function loadPersonnel() {
  const [res, agencyRes, stationRes, barangayRes, historyRes] = await Promise.all([
    fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    fetch(AGENCY_API_URL, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(STATION_API_URL, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(BARANGAY_API_URL, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${ASSIGNMENT_API_URL}/history`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  const data = await res.json();
  const agencyData = agencyRes.ok ? await agencyRes.json() : [];
  const stationData = stationRes.ok ? await stationRes.json() : [];
  const barangayData = barangayRes.ok ? await barangayRes.json() : [];
  const historyData = historyRes.ok ? await historyRes.json() : [];

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return;
    }

    table.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">${escapeHtml(data.message || "Unable to load personnel records.")}</td>
      </tr>
    `;
    return;
  }

  personnel = Array.isArray(data) ? data : [];
  agencies = Array.isArray(agencyData) ? agencyData : [];
  stations = Array.isArray(stationData) ? stationData : [];
  barangays = Array.isArray(barangayData) ? barangayData : [];
  assignmentHistory = Array.isArray(historyData) ? historyData : [];
  populateAssignmentOptions();
  renderPersonnel();
}

function applyAssignmentLocally(userIds, { agency, stationRef, barangayRef }) {
  const agencyRecord = agencies.find((item) => item._id === agency);
  const stationRecord = stations.find((item) => item._id === stationRef);
  const barangayRecord = barangays.find((item) => item._id === barangayRef);

  personnel = personnel.map((person) => {
    if (!userIds.includes(person._id)) return person;

    return {
      ...person,
      agency: agencyRecord || person.agency,
      stationRef: stationRecord || person.stationRef,
      station: stationRecord?.name || person.station,
      barangayRef: barangayRecord || person.barangayRef,
      barangay: barangayRecord?.name || person.barangay,
    };
  });
}

if (!canManagePersonnel) {
  form.closest(".panel")?.remove();
  stationForm.closest(".panel")?.remove();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!canManagePersonnel) return;

  const id = fields.userId.value;

  const payload = {
    name: fields.name.value.trim(),
    email: fields.email.value.trim(),
    role: fields.role.value,
    agency: normalizeAgencyId(fields.agency.value),
    rank: fields.rank.value.trim(),
    unit: fields.unit.value.trim(),
    stationRef: fields.station.value || null,
    barangayRef: fields.barangay.value || null,
    accountStatus: fields.accountStatus.value,
    responderStatus: fields.responderStatus.value,
    photo: selectedPhotoData,
  };

  const passwordValue = fields.password.value.trim();
  if (!id && passwordValue) {
    payload.password = passwordValue;
  }

  if (!id && !passwordValue) {
    alert("Password is required when creating personnel.");
    return;
  }

  const method = id ? "PUT" : "POST";
  const url = id ? `${API_URL}/${id}` : API_URL;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message || "Failed to save personnel");
    return;
  }

  if (id) {
    applyAssignmentLocally([id], {
      agency: payload.agency,
      stationRef: payload.stationRef,
      barangayRef: payload.barangayRef,
    });
    renderPersonnel();
  }

  alert(data.message || "Personnel saved successfully");

  form.reset();
  fields.userId.value = "";
  selectedPhotoData = "";
  loadPersonnel();
});

stationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManagePersonnel) return;

  const response = await fetch(STATION_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: assignmentFields.stationName.value.trim(),
      agency: normalizeAgencyId(assignmentFields.stationAgency.value),
      type: assignmentFields.stationType.value,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    alert(data.message || "Failed to add station");
    return;
  }

  stationForm.reset();
  loadPersonnel();
});

barangayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManagePersonnel) return;

  const response = await fetch(BARANGAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: assignmentFields.barangayName.value.trim(),
      district: assignmentFields.barangayDistrict.value.trim(),
      contactNumber: assignmentFields.barangayContactNumber.value.trim(),
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    alert(data.message || "Failed to add barangay");
    return;
  }

  barangayForm.reset();
  loadPersonnel();
});

bulkAssignmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManagePersonnel) return;

  const selectedIds = Array.from(document.querySelectorAll(".row-check:checked"))
    .map((checkbox) => checkbox.value);

  if (!selectedIds.length) {
    alert("Select at least one personnel record.");
    return;
  }

  if (!assignmentFields.bulkAgency.value && !assignmentFields.bulkStation.value && !assignmentFields.bulkBarangay.value) {
    alert("Choose an agency, station, or barangay assignment.");
    return;
  }

  const response = await fetch(`${ASSIGNMENT_API_URL}/personnel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userIds: selectedIds,
      agency: normalizeAgencyId(assignmentFields.bulkAgency.value),
      stationRef: assignmentFields.bulkStation.value || null,
      barangayRef: assignmentFields.bulkBarangay.value || null,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    alert(data.message || "Failed to assign personnel");
    return;
  }

  applyAssignmentLocally(selectedIds, {
    agency: normalizeAgencyId(assignmentFields.bulkAgency.value),
    stationRef: assignmentFields.bulkStation.value || null,
    barangayRef: assignmentFields.bulkBarangay.value || null,
  });
  renderPersonnel();
  alert(data.message || "Personnel assignments updated");
  bulkAssignmentForm.reset();
  loadPersonnel();
});

table.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const selectedUser = personnel.find((item) => item._id === actionButton.dataset.id);
  if (actionButton.dataset.action === "edit" && selectedUser) {
    editUser(selectedUser);
  }

  if (actionButton.dataset.action === "profile" && selectedUser) {
    openProfile(selectedUser);
  }

  if (actionButton.dataset.action === "toggle-status" && selectedUser) {
    toggleAccountStatus(selectedUser, actionButton.dataset.status);
  }

  if (actionButton.dataset.action === "delete") {
    deleteUser(actionButton.dataset.id);
  }
});

function editUser(user) {
  fields.userId.value = user._id;
  fields.name.value = user.name || "";
  fields.email.value = user.email || "";
  fields.password.value = "";
  fields.role.value = user.role || "responder";
  fields.agency.value = user.agency?._id || "";
  fields.rank.value = user.rank || "";
  fields.unit.value = user.unit || "";
  fields.station.value = user.stationRef?._id || "";
  fields.barangay.value = user.barangayRef?._id || "";
  fields.accountStatus.value = user.accountStatus || "active";
  fields.responderStatus.value = user.responderStatus || "offline";
  selectedPhotoData = user.photo || "";
  if (photoInput) photoInput.value = "";
}

async function deleteUser(id) {
  if (!confirm("Delete this personnel?")) return;

  await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  loadPersonnel();
}

async function toggleAccountStatus(user, nextStatus) {
  const label = nextStatus === "active" ? "activate" : "deactivate";
  if (!confirm(`Are you sure you want to ${label} ${user.name || "this personnel"}?`)) return;

  const res = await fetch(`${API_URL}/${user._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      role: user.role,
      agency: user.agency?._id || user.agency || null,
      rank: user.rank || "",
      unit: user.unit || "",
      stationRef: user.stationRef?._id || user.stationRef || null,
      barangayRef: user.barangayRef?._id || user.barangayRef || null,
      accountStatus: nextStatus,
      responderStatus: user.responderStatus || "offline",
      photo: user.photo || "",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.message || "Failed to update account status");
    return;
  }

  loadPersonnel();
}

function openProfile(user) {
  profileName.textContent = user.name || "Personnel Profile";
  profileSubtitle.textContent = `${formatLabel(user.role)}${user.unit ? ` - ${user.unit}` : ""}`;
  profilePhoto.innerHTML = renderPhoto(user);
  profileDetails.innerHTML = [
    ["Email", user.email],
    ["Role", formatLabel(user.role)],
    ["Agency", user.agency?.name || "N/A"],
    ["Rank", user.rank || "N/A"],
    ["Unit", user.unit || "N/A"],
    ["Station", user.stationRef?.name || user.station || "N/A"],
    ["Barangay", user.barangayRef?.name || user.barangay || "N/A"],
    ["Account", formatLabel(user.accountStatus || "active")],
    ["Responder Status", formatLabel(user.responderStatus || "offline")],
    ["Last Location", user.latitude && user.longitude ? `${user.latitude}, ${user.longitude}` : "N/A"],
  ]
    .map(
      ([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");

  profileModal.hidden = false;
  renderAssignmentHistory(user._id);
}

function renderAssignmentHistory(userId) {
  const rows = assignmentHistory.filter((item) => item.user?._id === userId || item.user === userId);

  assignmentHistoryList.innerHTML = rows.length
    ? rows.slice(0, 8).map((row) => `
        <div>
          <strong>${escapeHtml(formatLabel(row.action))}</strong>
          <span>${escapeHtml(row.next?.agency?.name || "No agency")} | ${escapeHtml(row.next?.station || "No station")} | ${escapeHtml(row.next?.barangay || "No barangay")}</span>
        </div>
      `).join("")
    : `<div><strong>No assignment changes yet</strong><span>Changes will appear after assignment or reassignment.</span></div>`;
}

function closeProfile() {
  profileModal.hidden = true;
}

if (personnelSearch) {
  personnelSearch.addEventListener("input", renderPersonnel);
}

profileEntrypoints.forEach((entrypoint) => {
  entrypoint.style.cursor = "pointer";
  entrypoint.addEventListener("click", () => {
    const currentUser = personnel.find((item) => item._id === user.id || item._id === user._id);
    if (currentUser) {
      openProfile(currentUser);
    }
  });
});

if (photoInput) {
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
      selectedPhotoData = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      photoInput.value = "";
      selectedPhotoData = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("Profile photo must be 1MB or smaller.");
      photoInput.value = "";
      selectedPhotoData = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      selectedPhotoData = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

if (closeProfileModal) {
  closeProfileModal.addEventListener("click", closeProfile);
}

if (profileModal) {
  profileModal.addEventListener("click", (event) => {
    if (event.target === profileModal) closeProfile();
  });
}

updateClock();
setInterval(updateClock, 30000);
loadPersonnel();
