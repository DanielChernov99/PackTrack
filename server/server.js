import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());  //in the future, restrict origins for security
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.log(err));

app.get("/", (req, res) => {res.send("PackTrack Server is running")});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`);});

// Routes 
import userRoutes from "./routes/userRoutes.js";
import packerRoutes from "./routes/packerRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";

app.use("/api/users", userRoutes);
app.use("/api/packers", packerRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/roles", roleRoutes);