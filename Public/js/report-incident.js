const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const allowedRoles = ["admin", "commander", "responder", "police", "fire", "medical", "drrm", "barangay"];

if (!token || !allowedRoles.includes(user.role)) {
  window.location.replace("/login.html");
  throw new Error("Authorized account required");
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const roleLabels = {
  admin: "System Administrator",
  commander: "Commander",
  police: "Police Responder",
  fire: "Fire Responder",
  medical: "Medical Responder",
  drrm: "DRRM Responder",
  barangay: "Barangay Responder",
  responder: "Field Responder",
};

const subtypeOptions = {
  public_safety: [
    ["crime", "Crime"],
    ["public_disturbance", "Public Disturbance"],
    ["security_threat", "Security Threat"],
    ["missing_person", "Missing Person"],
  ],
  fire_rescue: [
    ["fire_incident", "Fire Incident"],
    ["rescue_operation", "Rescue Operation"],
  ],
  medical: [["medical_emergency", "Medical Emergency"]],
  disaster: [
    ["flood", "Flood"],
    ["earthquake", "Earthquake"],
  ],
  transportation: [["traffic_accident", "Traffic Accident"]],
  other: [["general_incident", "General Incident"]],
};

const maxPhotoSize = 5 * 1024 * 1024;
const maxEvidenceSize = 10 * 1024 * 1024;
const allowedEvidenceTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const allowedEvidenceExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];

const els = {
  responderName: document.getElementById("responderName"),
  responderRole: document.getElementById("responderRole"),
  topResponderName: document.getElementById("topResponderName"),
  topResponderRole: document.getElementById("topResponderRole"),
  logoutBtn: document.getElementById("logoutBtn"),
  form: document.getElementById("incidentForm"),
  message: document.getElementById("incidentFormMessage"),
  category: document.getElementById("incidentCategory"),
  subtype: document.getElementById("incidentSubtype"),
  description: document.getElementById("description"),
  address: document.getElementById("address"),
  latitude: document.getElementById("latitude"),
  longitude: document.getElementById("longitude"),
  severity: document.getElementById("severity"),
  photos: document.getElementById("photos"),
  evidence: document.getElementById("evidence"),
  captureGpsBtn: document.getElementById("captureGpsBtn"),
};

els.responderName.textContent = user.name || "User";
els.topResponderName.textContent = user.name || "User";
els.responderRole.textContent = roleLabels[user.role] || "Authorized User";
els.topResponderRole.textContent = roleLabels[user.role] || "Authorized User";

function setMessage(message, type = "info") {
  els.message.textContent = message;
  els.message.className = `incident-form-message ${type}`;
}

function renderSubtypes() {
  const options = subtypeOptions[els.category.value] || [];
  els.subtype.innerHTML = `<option value="">Select Incident Type</option>${options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("")}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function validateRequiredFields() {
  if (!els.category.value) return "Category is required.";
  if (!els.subtype.value) return "Incident type is required.";
  if (!els.description.value.trim()) return "Description is required.";
  if (!els.address.value.trim()) return "Address is required.";
  if (!els.latitude.value || !els.longitude.value) return "GPS coordinates are required.";
  return "";
}

function validateGps() {
  const latitude = Number(els.latitude.value);
  const longitude = Number(els.longitude.value);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return "Latitude must be a valid number between -90 and 90.";
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "Longitude must be a valid number between -180 and 180.";
  }

  return "";
}

function validateFiles(input, options) {
  const files = Array.from(input.files || []);
  const invalid = files.find((file) => {
    const typeAllowed = options.accepts(file);
    return !typeAllowed || file.size > options.maxSize;
  });

  if (!invalid) return "";
  const maxMb = Math.round(options.maxSize / 1024 / 1024);
  return `${invalid.name} is not allowed. Max size is ${maxMb}MB.`;
}

async function readFiles(input) {
  const files = Array.from(input.files || []);
  return Promise.all(files.map(readFileAsDataUrl));
}

els.category.addEventListener("change", renderSubtypes);

els.captureGpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setMessage("GPS is not available in this browser.", "error");
    return;
  }

  setMessage("Capturing GPS location...", "info");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      els.latitude.value = position.coords.latitude;
      els.longitude.value = position.coords.longitude;
      setMessage("GPS location captured.", "success");
    },
    () => setMessage("Unable to capture GPS location.", "error"),
    { enableHighAccuracy: true, timeout: 12000 }
  );
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Submitting incident report...", "info");

  try {
    const validationError = validateRequiredFields()
      || validateGps()
      || validateFiles(els.photos, {
        maxSize: maxPhotoSize,
        accepts: (file) => file.type.startsWith("image/"),
      })
      || validateFiles(els.evidence, {
        maxSize: maxEvidenceSize,
        accepts: (file) => {
          const name = file.name.toLowerCase();
          return allowedEvidenceTypes.includes(file.type)
            || allowedEvidenceExtensions.some((extension) => name.endsWith(extension));
        },
      });

    if (validationError) {
      throw new Error(validationError);
    }

    const [photos, evidence] = await Promise.all([
      readFiles(els.photos),
      readFiles(els.evidence),
    ]);

    const title = els.subtype.options[els.subtype.selectedIndex]?.text || "Reported Incident";
    const response = await fetch("/api/incidents", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        type: els.category.value,
        incidentSubtype: els.subtype.value,
        description: els.description.value.trim(),
        address: els.address.value.trim(),
        latitude: Number(els.latitude.value),
        longitude: Number(els.longitude.value),
        severity: els.severity.value,
        photos,
        evidence,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to submit incident");
    }

    els.form.reset();
    renderSubtypes();
    setMessage(`Incident submitted: ${data.incident.incidentId || data.incident.incidentNumber}`, "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

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

renderSubtypes();
