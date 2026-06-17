const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const loginPanel = document.getElementById("loginPanel");
const forgotPanel = document.getElementById("forgotPanel");
const showForgotPassword = document.getElementById("showForgotPassword");
const showLogin = document.getElementById("showLogin");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const forgotMessage = document.getElementById("forgotMessage");
const resetMessage = document.getElementById("resetMessage");
const resetCodeNote = document.getElementById("resetCodeNote");

function showMessage(element, message, type = "error") {
  element.className = type === "success" ? "success-message" : "error-message";
  element.textContent = message;
  element.style.display = "block";
}

function hideMessage(element) {
  element.textContent = "";
  element.style.display = "none";
}

function switchPanel(panel) {
  loginPanel.classList.toggle("active", panel === "login");
  forgotPanel.classList.toggle("active", panel === "forgot");
  hideMessage(errorMessage);
  hideMessage(forgotMessage);
  hideMessage(resetMessage);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  hideMessage(errorMessage);

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    const role = data.user.role;

    if (role === "admin") {
      window.location.href = "/admin-dashboard.html";
    } else if (role === "commander") {
      window.location.href = "/commander-dashboard.html";
    } else {
      window.location.href = "/responder-dashboard.html";
    }

  } catch (error) {
    showMessage(errorMessage, error.message);
  }
});

showForgotPassword.addEventListener("click", () => {
  const currentEmail = document.getElementById("email").value.trim();
  document.getElementById("resetEmail").value = currentEmail;
  switchPanel("forgot");
});

showLogin.addEventListener("click", () => {
  switchPanel("login");
});

forgotPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  hideMessage(forgotMessage);
  hideMessage(resetMessage);
  resetCodeNote.style.display = "none";

  const email = document.getElementById("resetEmail").value.trim();

  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to generate reset code");
    }

    if (data.resetCode) {
      resetCodeNote.innerHTML = `Temporary reset code: <strong>${data.resetCode}</strong><br />Use it within 15 minutes.`;
      resetCodeNote.style.display = "block";
      document.getElementById("resetCode").value = data.resetCode;
    } else {
      showMessage(forgotMessage, data.message, "success");
    }
  } catch (error) {
    showMessage(forgotMessage, error.message);
  }
});

resetPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  hideMessage(forgotMessage);
  hideMessage(resetMessage);

  const email = document.getElementById("resetEmail").value.trim();
  const resetCode = document.getElementById("resetCode").value.trim();
  const password = document.getElementById("newPassword").value.trim();

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        resetCode,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to reset password");
    }

    resetPasswordForm.reset();
    forgotPasswordForm.reset();
    resetCodeNote.style.display = "none";
    showMessage(resetMessage, data.message, "success");
  } catch (error) {
    showMessage(forgotMessage, error.message);
  }
});
