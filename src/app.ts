import express from "express";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import bookingRoutes from "./routes/booking.routes";
import catalogRoutes from "./routes/catalog.routes";
import deliveryRoutes from "./routes/delivery.routes";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";

const app = express();

app.use(express.json({ limit: "15mb" }));
app.use(requestLoggerMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "OK" });
});

app.use("/auth", authRoutes);
app.use("/catalog", catalogRoutes);
app.use("/bookings", bookingRoutes);
app.use("/delivery", deliveryRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/admin", adminRoutes);


app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
