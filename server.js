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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/agencies", agencyRoutes);
app.use("/api/gps", gpsRoutes);
app.use("/api/incidents", incidentRoutes);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.emit("testConnection", {
    message: "Socket.IO test successful"
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});