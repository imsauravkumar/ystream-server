import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";

const port = process.env.PORT || 5000;
const { default: app } = await import("./app.js");
const { connectDatabase } = await import("./config/database.js");
const { createSocketServer } = await import("./socket/index.js");
const httpServer = createServer(app);

createSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`Ystream server listening on port ${port}`);
});

connectDatabase().catch((error) => {
  console.error(`MongoDB connection failed: ${error.message}`);
});
