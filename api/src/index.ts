import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Load .env from current working directory and fallback to api/.env when started elsewhere.
dotenv.config({ quiet: true });
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value && value !== "replace_me") {
      return value;
    }
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

function parsePort(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const app = express();
app.use(express.json());

const PORT = parsePort(process.env.PORT, 4000);
const BASE = requiredEnv("OPENEMR_BASE").replace(/\/+$/, "");
const CLIENT_ID = requiredEnv("CLIENT_ID", "OPENEMR_CLIENT_ID");
const CLIENT_SECRET = requiredEnv("CLIENT_SECRET", "OPENEMR_CLIENT_SECRET");
const USERNAME = requiredEnv("USERNAME", "OPENEMR_USERNAME");
const PASSWORD = requiredEnv("PASSWORD", "OPENEMR_PASSWORD");
const USER_ROLE = (process.env.USER_ROLE ?? process.env.OPENEMR_USER_ROLE ?? "users").trim();
const TOKEN_PATH = process.env.OPENEMR_TOKEN_PATH?.trim() || "/oauth2/default/token";
const TOKEN_SCOPE =
  process.env.OPENEMR_TOKEN_SCOPE?.trim() || "openid api:oemr user/patient.read user/patient.write";
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server and curl requests that have no browser Origin.
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);

const openemrClient = axios.create({
  baseURL: BASE,
  timeout: parsePort(process.env.OPENEMR_TIMEOUT_MS, 15000),
});

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;
let tokenPromise: Promise<string> | null = null;

function tokenEndpointUrl(): string {
  const normalizedPath = TOKEN_PATH.startsWith("/") ? TOKEN_PATH : `/${TOKEN_PATH}`;
  return `${BASE}${normalizedPath}`;
}

function isCachedTokenValid(): boolean {
  if (!tokenCache) return false;
  const refreshBufferMs = 10_000;
  return Date.now() + refreshBufferMs < tokenCache.expiresAtMs;
}

async function fetchTokenFromOpenEMR(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    username: USERNAME,
    password: PASSWORD,
    user_role: USER_ROLE,
  });

  if (TOKEN_SCOPE) {
    body.set("scope", TOKEN_SCOPE);
  }

  const resp = await axios.post(tokenEndpointUrl(), body.toString(), {
    timeout: parsePort(process.env.OPENEMR_TIMEOUT_MS, 15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const accessToken = String(resp.data?.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error("OpenEMR token response missing access_token");
  }

  const expiresInSeconds = Number(resp.data?.expires_in ?? 300);
  const ttlMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds * 1000 : 300_000;
  tokenCache = {
    accessToken,
    expiresAtMs: Date.now() + ttlMs,
  };

  return accessToken;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && isCachedTokenValid()) {
    return tokenCache!.accessToken;
  }

  if (!tokenPromise) {
    tokenPromise = fetchTokenFromOpenEMR().finally(() => {
      tokenPromise = null;
    });
  }

  return tokenPromise;
}

async function openemrRequest<T>(config: {
  method: "get" | "post";
  url: string;
  data?: unknown;
}): Promise<T> {
  const token = await getAccessToken();

  try {
    const resp = await openemrClient.request<T>({
      method: config.method,
      url: config.url,
      data: config.data,
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status !== 401) {
      throw err;
    }

    // Token may be expired/revoked early; refresh and retry once.
    const refreshedToken = await getAccessToken(true);
    const retry = await openemrClient.request<T>({
      method: config.method,
      url: config.url,
      data: config.data,
      headers: { Authorization: `Bearer ${refreshedToken}` },
    });
    return retry.data;
  }
}

// Standard API: list patients
// NOTE: endpoint shape can vary; if this returns 404, we'll switch to the correct listing endpoint via swagger.
app.get("/patients", async (_req, res) => {
  try {
    const data = await openemrRequest({ method: "get", url: "/apis/default/api/patient" });
    res.json(data);
  } catch (err: any) {
    const statusCode = err?.response?.status ?? 500;
    res.status(statusCode).json({
      error: "Failed to fetch patients from OpenEMR standard API",
      detail: err?.response?.data ?? err?.message,
      status: statusCode,
    });
  }
});

app.post("/patients", async (req, res) => {
  try {
    const { fname, lname, DOB, sex } = req.body ?? {};

    // basic validation
    if (!fname || !lname || !DOB || !sex) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["fname", "lname", "DOB", "sex"],
      });
    }

    const data = await openemrRequest({
      method: "post",
      url: "/apis/default/api/patient",
      data: { fname, lname, DOB, sex },
    });

    res.status(201).json(data);
  } catch (err: any) {
    const statusCode = err?.response?.status ?? 500;
    res.status(statusCode).json({
      error: "Failed to create patient in OpenEMR",
      detail: err?.response?.data ?? err?.message,
      status: statusCode,
    });
  }
});

app.listen(PORT, "0.0.0.0",, () => {
  console.log(`API running on port ${PORT}`);
  console.log(`CORS_ORIGINS=${CORS_ORIGINS.join(",")}`);
  console.log(`OPENEMR_TOKEN_PATH=${TOKEN_PATH}`);
  console.log(`USER_ROLE=${USER_ROLE}`);
});
