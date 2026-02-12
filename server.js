const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

/* ================= IN-MEMORY STORAGE ================= */
let students = [];
let otpStore = {};
let pendingUploads = [];
let costMessages = {};
let adminSessions = {};

/* ================= ADMIN LOGIN ================= */
const ADMIN_EMAIL = "nmap2420@gmail.com";
const ADMIN_PASS = "admin123"; // change later

app.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    const token = Date.now().toString();
    adminSessions[token] = true;
    return res.json({ success: true, token });
  }

  res.status(401).json({ error: "Invalid admin credentials" });
});

function verifyAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!adminSessions[token]) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

/* ================= EMAIL SETUP (FAST SMTP) ================= */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "nmap2420@gmail.com",
    pass: "yxbc sodd sunt sdhk"
  }
});

/* ================= FILE UPLOAD ================= */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

/* ================= SEND OTP (FAST RESPONSE) ================= */
app.post("/send-otp", async (req, res) => {
  const { name, email } = req.body;

  const existing = students.find(s => s.email === email);
  if (existing) return res.json({ alreadyRegistered: true });

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = otp;

  // respond immediately
  res.json({ success: true });

  // send email in background
  try {
    await transporter.sendMail({
      from: "Student App",
      to: email,
      subject: "Your OTP Code",
      text: Hello ${name}, your OTP is ${otp}
    });
  } catch (err) {
    console.log("Email error:", err);
  }
});

/* ================= VERIFY OTP ================= */
app.post("/verify-otp", (req, res) => {
  const { name, email, otp } = req.body;

  if (otpStore[email] && otpStore[email] == otp) {
    students.push({ name, email });
    delete otpStore[email];
    return res.json({ success: true });
  }

  res.status(400).json({ error: "Invalid OTP" });
});

/* ================= UPLOAD ================= */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { name, email, type, link } = req.body;

    pendingUploads.push({
      id: Date.now().toString(),
      name,
      email,
      type,
      link,
      file: req.file
    });

    let text = Student: ${name}\nEmail: ${email}\nType: ${type};
    if (link) text += \nLink: ${link};

    const mailOptions = {
      from: "Student App",
      to: ADMIN_EMAIL,
      subject: New ${type} uploaded by ${name},
      text
    };

    if (req.file) {
      mailOptions.attachments = [
        { filename: req.file.originalname, path: req.file.path }
      ];
    }

    await transporter.sendMail(mailOptions);

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Upload/email failed" });
  }
});

/* ================= ADMIN: VIEW PENDING ================= */
app.get("/admin/pending", verifyAdmin, (req, res) => {
  res.json(pendingUploads);
});

/* ================= ADMIN: SET COST ================= */
app.post("/admin/set-cost", verifyAdmin, (req, res) => {
  const { uploadId, cost } = req.body;

  const index = pendingUploads.findIndex(u => u.id === uploadId);
  if (index === -1) return res.status(404).json({ error: "Upload not found" });

  const email = pendingUploads[index].email;

  pendingUploads.splice(index, 1);
  costMessages[email] = cost;

  res.json({ success: true });
});

/* ================= ADMIN: STUDENTS LIST ================= */
app.get("/admin/students", verifyAdmin, (req, res) => {
  res.json(students);
});

/* ================= STUDENT GET COST ================= */
app.get("/get-cost/:email", (req, res) => {
  const email = req.params.email;

  if (!costMessages[email]) return res.json({ cost: null });

  const cost = costMessages[email];
  delete costMessages[email];

  res.json({ cost });
});

/* ================= PAYMENT RESPONSE ================= */
app.post("/payment-response", (req, res) => {
  const { email, confirmed } = req.body;

  console.log(
    Payment from ${email}: ${confirmed ? "CONFIRMED" : "DECLINED"}
  );

  res.json({ success: true });
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
