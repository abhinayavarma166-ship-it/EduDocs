/* ================= ELEMENTS ================= */
const loginScreen = document.getElementById("login");
const deptScreen = document.getElementById("dept");
const essentialsScreen = document.getElementById("essentials");
const uploadScreen = document.getElementById("upload");

const pdfInput = document.getElementById("pdfInput");
const photoInput = document.getElementById("photoInput");
const chatBox = document.getElementById("chatContainer");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");

let currentEmail = "";
let pollingInterval = null;

/* ================= LOGIN ================= */
async function openDept() {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name || !email) return alert("Enter name & email");

  const res = await fetch("/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email })
  });

  const data = await res.json();

  if (!data.alreadyRegistered) {
    const otp = prompt("Enter OTP sent to email:");
    if (!otp) return;

    const verify = await fetch("/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, otp })
    });

    const verifyData = await verify.json();
    if (!verifyData.success) return alert("Invalid OTP");
  }

  currentEmail = email;

  loginScreen.style.display = "none";
  deptScreen.classList.remove("hidden");

  startCostPolling();
}

/* ================= NAVIGATION ================= */
function openEssentials() {
  deptScreen.classList.add("hidden");
  essentialsScreen.classList.remove("hidden");
}

function openUpload() {
  essentialsScreen.classList.add("hidden");
  uploadScreen.classList.remove("hidden");
}

function goBack(page) {
  loginScreen.style.display = "none";
  deptScreen.classList.add("hidden");
  essentialsScreen.classList.add("hidden");
  uploadScreen.classList.add("hidden");

  if (page === "login") {
    loginScreen.style.display = "flex";
    stopCostPolling();
  } else {
    document.getElementById(page).classList.remove("hidden");
  }
}

/* ================= CHAT ================= */
function addMessage(content, isUser = true) {
  const div = document.createElement("div");
  div.className = `message ${isUser ? "user" : "bot"}`;
  div.innerHTML = content;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ================= SEND UPLOAD ================= */
async function sendToServer(formData) {
  try {
    const res = await fetch("/upload", { method: "POST", body: formData });

    if (res.ok) {
      addMessage("✅ Sent to admin. Waiting for cost...", false);
    } else {
      addMessage("❌ Upload failed", false);
    }
  } catch {
    addMessage("❌ Server error", false);
  }
}

/* ================= UPLOAD FUNCTIONS ================= */
function uploadPDF() {
  pdfInput.click();

  pdfInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    addMessage("📑 " + file.name);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", nameInput.value);
    fd.append("email", currentEmail);
    fd.append("type", "PDF");

    await sendToServer(fd);

    pdfInput.value = ""; // reset
  };
}

function uploadPhoto() {
  photoInput.click();

  photoInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    addMessage(`<img src="${URL.createObjectURL(file)}" class="preview">`);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", nameInput.value);
    fd.append("email", currentEmail);
    fd.append("type", "Photo");

    await sendToServer(fd);

    photoInput.value = ""; // reset
  };
}

async function uploadLink() {
  const link = prompt("Enter link:");
  if (!link) return;

  addMessage("🔗 " + link);

  const fd = new FormData();
  fd.append("name", nameInput.value);
  fd.append("email", currentEmail);
  fd.append("type", "Link");
  fd.append("link", link);

  await sendToServer(fd);
}

/* ================= COST POLLING ================= */
function startCostPolling() {
  stopCostPolling(); // prevent duplicates

  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/get-cost/${currentEmail}`);
      const data = await res.json();

      if (data.cost) showCostMessage(data.cost);
    } catch {
      console.log("Polling error");
    }
  }, 5000);
}

function stopCostPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/* ================= SHOW COST ================= */
function showCostMessage(cost) {
  const div = document.createElement("div");
  div.className = "message bot";
  div.innerHTML = `
    💰 Admin set cost: ₹${cost}
    <div class="confirm-decline">
      <button onclick="sendPayment(true, this)">Confirm</button>
      <button onclick="sendPayment(false, this)">Decline</button>
    </div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ================= SEND PAYMENT ================= */
async function sendPayment(confirmed, btn) {
  await fetch("/payment-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentEmail, confirmed })
  });

  btn.parentElement.innerHTML = confirmed
    ? "✅ Payment Confirmed"
    : "❌ Payment Declined";
}
