import { config as loadEnv } from "dotenv"
loadEnv({ path: "frontend/.env" })

const token = process.env.TEST_TOKEN || "mock-token"
console.log("Token:", token)
