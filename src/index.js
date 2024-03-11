import { configDotenv } from "dotenv";
import ConnectDB from "./db/index.js";

configDotenv({
    path: './env'
})

ConnectDB();