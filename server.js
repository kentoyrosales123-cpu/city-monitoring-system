require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const agencyRoutes = require("./routes/agencyRoutes");
const stationRoutes = require("./routes/stationRoutes");
const barangayRoutes = require("./routes/barangayRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const gpsRoutes = require("./routes/gpsRoutes");
const incidentRoutes = require("./routes/incidentRoutes");

const createDefaultAdmin = require("./utils/createAdmin");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("io", io);

connectDB();
createDefaultAdmin();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "Public")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/agencies", agencyRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/barangays", barangayRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/gps", gpsRoutes);
app.use("/api/incidents", incidentRoutes);

io.on("connection", (socket) => {
  socket.on("registerUser", async (userId) => {
    socket.userId = userId;
  });

  socket.on("disconnect", async () => {
    if (!socket.userId) return;

    const User = require("./models/User");

    const user = await User.findByIdAndUpdate(
      socket.userId,
      {
        isOnline: false,
        responderStatus: "offline",
        lastSeenAt: new Date(),
      },
      { new: true }
    );

    if (user) {
      io.emit("responderStatusUpdated", {
        responderId: user._id,
        status: "offline",
        isOnline: false,
        lastSeenAt: user.lastSeenAt,
      });
    }
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "login.html"));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
