const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token || user.role !== "admin") {
  window.location.href = "/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const usersTable = document.getElementById("usersTable");
const searchInput = document.getElementById("searchInput");

document.getElementById("adminName").textContent = user.name || "Admin User";
document.getElementById("adminRole").textContent =
  user.rank || user.position || "System Administrator";

let users = [];

async function fetchUsers() {
  try {
    const response = await fetch("/api/users", { headers });

    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      return;
    }

    users = await response.json();
    renderStats(users);
    renderUsers(users);
  } catch (error) {
    usersTable.innerHTML = `<tr><td colspan="7">Failed to load users.</td></tr>`;
  }
}

function renderStats(data) {
  document.getElementById("totalUsers").textContent = data.length;
  document.getElementById("activeUsers").textContent =
    data.filter(u => u.status === "active").length;
  document.getElementById("onDutyUsers").textContent =
    data.filter(u => u.status === "on_duty").length;
  document.getElementById("inactiveUsers").textContent =
    data.filter(u => u.status === "inactive").length;
}

function renderUsers(data) {
  if (!data.length) {
    usersTable.innerHTML = `<tr><td colspan="7">No personnel found.</td></tr>`;
    return;
  }

  usersTable.innerHTML = data.map(u => `
    <tr>
      <td>${u.name || "-"}</td>
      <td>${u.email || "-"}</td>
      <td>${formatLabel(u.role)}</td>
      <td>${u.rank || "-"}</td>
      <td>${u.unit || "-"}</td>
      <td>
        <select onchange="updateStatus('${u._id}', this.value)">
          <option value="active" ${u.status === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${u.status === "inactive" ? "selected" : ""}>Inactive</option>
          <option value="on_duty" ${u.status === "on_duty" ? "selected" : ""}>On Duty</option>
          <option value="off_duty" ${u.status === "off_duty" ? "selected" : ""}>Off Duty</option>
        </select>
      </td>
      <td>
        <button onclick="updateStatus('${u._id}', '${u.status === "inactive" ? "active" : "inactive"}')">
          ${u.status === "inactive" ? "Activate" : "Deactivate"}
        </button>
      </td>
    </tr>
  `).join("");
}

async function updateStatus(id, status) {
  const target = users.find(u => u._id === id);

  if (!target) return;

  await fetch(`/api/users/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      name: target.name,
      email: target.email,
      role: target.role,
      agency: target.agency?._id || target.agency || null,
      rank: target.rank,
      unit: target.unit,
      status,
    }),
  });

  fetchUsers();
}

function formatLabel(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase());
}

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.toLowerCase();

  const filtered = users.filter(u =>
    String(u.name).toLowerCase().includes(keyword) ||
    String(u.email).toLowerCase().includes(keyword) ||
    String(u.role).toLowerCase().includes(keyword) ||
    String(u.unit).toLowerCase().includes(keyword)
  );

  renderUsers(filtered);
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

fetchUsers();
