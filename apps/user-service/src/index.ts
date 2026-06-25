import express from "express";
import userRoutes from "./routes/user.routes";

const app = express();
const PORT = 4001;

app.use(express.json());
app.use("/api/users", userRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

app.listen(PORT, () => {
  console.log(`User service running on http://localhost:${PORT}`);
});
