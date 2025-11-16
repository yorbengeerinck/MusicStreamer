import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import { google, drive_v3 } from "googleapis";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import morgan from "morgan";

const app = express();
app.set("trust proxy", 1);

// Zet access logging BOVEN routes/middleware
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Parsers voor JSON en form-data (moet vóór je routes)
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Redirect http -> https (Render/Proxy)
app.use((req, res, next) => {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  if (proto !== "https" && process.env.NODE_ENV === "production") {
    const host = req.headers.host;
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// Helmet met HSTS (alleen zinvol op HTTPS)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
  })
);

if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'"],
        // Voeg iconify endpoints toe aan connect-src
        connectSrc: [
          "'self'",
          "https://api.iconify.design",
          "https://api.unisvg.com",
          "https://api.simplesvg.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    })
  );
}

// CORS strikt zetten (Render domein + localhost dev)
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN?.split(",").map(s => s.trim()).filter(Boolean) ||
      ["http://localhost:5173"]),
    credentials: false,
  })
);

// Rate limiting op API + stream
app.use(
  ["/api/", "/stream"],
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Config via env
const USERS_HASH: Record<string, string> = {
  yorben: process.env.PASS_YORBEN_HASH || "",
  zus: process.env.PASS_YENTHEL_HASH || "",
};

// Auth secrets (met rotatie)
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
const AUTH_SECRET_PREV = process.env.AUTH_SECRET_PREV || "";

// Helper: cache-control no-store
function noStore(res: express.Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

const TOKEN_TTL_MS =
  Number(process.env.AUTH_TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 7); // 7 dagen

type TokenPayload = { u: string; exp: number };

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function signToken(payload: TokenPayload) {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", AUTH_SECRET).update(body).digest()
  );
  return `${body}.${sig}`;
}
function verifyToken(token: string): TokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const h = (s: string) => b64url(crypto.createHmac("sha256", s).update(body).digest());
  const ok = sig === h(AUTH_SECRET) || (AUTH_SECRET_PREV && sig === h(AUTH_SECRET_PREV));
  if (!ok) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString()) as TokenPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// Token uit header of query
function getTokenFromRequest(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  if (typeof req.query.t === "string") return req.query.t;
  return null;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: "Unauthorized" });
  (req as any).user = payload.u;
  next();
}

// Open API’s
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
app.post("/api/login", loginLimiter, async (req, res) => {
  if (!req.is("application/json")) return res.status(415).json({ error: "Content-Type application/json vereist" });
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "username en password verplicht" });

  // Bcrypt-only (geen plain env)
  const hash = USERS_HASH[username] || "";
  if (!hash) return res.status(401).json({ error: "Onbekende gebruiker" });

  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.status(401).json({ error: "Onjuist wachtwoord" });

  const token = signToken({ u: username, exp: Date.now() + TOKEN_TTL_MS });
  noStore(res);
  res.json({ token, user: username, expiresInMs: TOKEN_TTL_MS });
});

app.get("/api/auth/verify", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ ok: false });
  noStore(res);
  res.json({ ok: true, user: payload.u });
});

// Protect alle andere /api/* endpoints
app.use("/api", (req, res, next) => {
  if (req.path === "/login" || req.path === "/auth/verify") return next();
  return requireAuth(req, res, next);
});

const PORT = process.env.PORT || 5000;

// Pad naar frontend/dist
const frontendPath = path.join(__dirname, "../../frontend/dist");

// ✅ Statische frontend serveren (root)
app.use("/", express.static(frontendPath));

// ===== Google Drive auth (createDrive) blijft ongewijzigd =====
type SA = { client_email: string; private_key: string };

function loadServiceAccountFromEnv(): SA | null {
  const raw = process.env.GOOGLE_SERVICE_JSON || process.env.GOOGLE_SERVICE_JSON_B64;
  if (!raw) return null;
  try {
    const jsonStr = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(jsonStr);
    let pk = String(parsed.private_key || "");

    // Herstel line endings uit env (\n → echte newlines)
    pk = pk.replace(/\\n/g, "\n").replace(/\r/g, "");

    // ✅ Render-fix: als Render de newlines of headers verknoeit, fix het
    if (!pk.includes("-----BEGIN") && pk.replace(/\s+/g, "").includes("BEGINPRIVATEKEY")) {
      pk = pk
        .replace(/-----BEGINPRIVATEKEY-----/, "-----BEGIN PRIVATE KEY-----\n")
        .replace(/-----ENDPRIVATEKEY-----/, "\n-----END PRIVATE KEY-----\n");
    }

    if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(pk)) {
      console.error("[Drive] private_key lijkt ongeldig. Eerste chars:", pk.slice(0, 50));
      throw new Error("private_key heeft geen geldige PEM header");
    }

    return { client_email: parsed.client_email, private_key: pk };
  } catch (e) {
    console.error("[Drive] GOOGLE_SERVICE_JSON onleesbaar:", e);
    return null;
  }
}

function createDrive() {
  const sa = loadServiceAccountFromEnv();
  if (sa) {
    const auth = new google.auth.GoogleAuth({
      credentials: sa,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    console.log("[Drive] Service account uit env gebruikt.");
    return google.drive({ version: "v3", auth });
  }

  const keyFile =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(process.cwd(), "backend", "service-account.json") ||
    "service-account.json";
  if (keyFile && fs.existsSync(keyFile)) {
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    console.log("[Drive] keyFile gebruikt:", keyFile);
    return google.drive({ version: "v3", auth });
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    console.log("[Drive] OAuth2 refresh token gebruikt.");
    return google.drive({ version: "v3", auth: oauth2 });
  }

  console.error("[Drive] GEEN geldige Google credentials gevonden.");
  throw new Error("No Google credentials configured");
}

const drive = createDrive();

const COLLECTIONS: Record<string, string | undefined> = {
  default: process.env.DRIVE_FOLDER_ID,
  yenthel: process.env.YENTHEL_FOLDER_ID,
};

// Endpoint om mp3-bestanden op te halen
app.get("/songs", requireAuth, async (req, res) => {
  try {
    const selected = (req.query.collection as string) || "default";
    const folderId = COLLECTIONS[selected];

    let q =
      "(mimeType contains 'audio/' or name contains '.mp3')" +
      " and trashed = false" +
      " and mimeType != 'application/vnd.google-apps.folder'";

    if (folderId) {
      q += ` and '${folderId}' in parents`;
    } else if (selected !== "default") {
      return res.status(400).json({
        error: `Folder ID niet geconfigureerd voor collectie '${selected}'. Zet YENTHEL_FOLDER_ID in .env.`,
      });
    }

    let files: { id: string; name: string }[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const response: drive_v3.Schema$FileList = (
        await drive.files.list({
          q,
          fields: "nextPageToken, files(id, name, mimeType)",
          pageSize: 100,
          pageToken,
          orderBy: "name_natural",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        })
      ).data;

      const newFiles = (response.files ?? []).map(f => ({ id: f.id!, name: f.name! }));
      files = files.concat(newFiles);
      pageToken = response.nextPageToken || undefined;
    } while (pageToken);

    // Voor listings: niet cachen
    noStore(res);

    res.json(files);
  } catch (err) {
    console.error("Fout:", err);
    res.status(500).send("Fout bij ophalen van muziek");
  }
});

function signStream(fileId: string, expMs: number) {
  const data = `${fileId}.${expMs}`;
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  return sig;
}
function verifyStreamSig(fileId: string, expMs: number, sig: string) {
  if (!expMs || Date.now() > Number(expMs)) return false;
  const expected = signStream(fileId, Number(expMs));
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
function getBaseUrl(req: express.Request) {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers.host;
  return `${proto}://${host}`;
}

// Rate limit voor het genereren van signed URLs
const streamUrlLimiter = rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true, legacyHeaders: false });

// Kortlevende, gesigneerde stream-URL (sessietoken vereist)
app.get("/api/stream-url/:id", streamUrlLimiter, requireAuth, (req, res) => {
  const fileId = String(req.params.id || "");
  if (!/^[A-Za-z0-9_\-]{10,}$/.test(fileId)) return res.status(400).json({ error: "Invalid id" });

  const exp = Date.now() + 60_000; // 60s geldig
  const s = signStream(fileId, exp);
  const url = `${getBaseUrl(req)}/stream/${fileId}?s=${encodeURIComponent(s)}&exp=${exp}`;
  noStore(res);
  res.json({ url, exp });
});

// ===== STREAM CORS HELPERS + MIDDLEWARE (BOVEN de route!) =====

function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN?.split(",").map(s => s.trim()).filter(Boolean) || ["http://localhost:5173"]);
}

function setStreamCorsHeaders(req: express.Request, res: express.Response) {
  const allowed = getAllowedOrigins();
  const origin = String(req.headers.origin || "");
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", allowed[0] || "*");
  }
  res.setHeader("Access-Control-Allow-Headers", "Range,Content-Type,Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Accept-Ranges,Content-Length,Content-Range");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
}

// Middleware voor alle /stream requests (moet VOOR de route komen!)
app.use("/stream", (req, res, next) => {
  setStreamCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// ===== NU PAS DE /stream ROUTE =====

app.get("/stream/:id", async (req, res) => {
  try {
    const fileId = String(req.params.id || "");
    const { s, exp } = req.query as { s?: string; exp?: string };
    if (!/^[A-Za-z0-9_\-]{10,}$/.test(fileId)) return res.status(400).send("Invalid file id");
    if (!s || !exp || !verifyStreamSig(fileId, Number(exp), s)) return res.status(401).send("Unauthorized");

    const meta = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size",
      supportsAllDrives: true,
    });

    const mime = meta.data.mimeType || "audio/mpeg";
    const size = meta.data.size ? parseInt(meta.data.size, 10) : undefined;
    const range = req.headers.range;

    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");

    if (!size || !range) {
      res.setHeader("Content-Type", mime);
      if (size) res.setHeader("Content-Length", String(size));
      res.setHeader("Accept-Ranges", "bytes");

      const driveResponse = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream" }
      );

      driveResponse.data.on("error", (err: any) => {
        console.error("Stream error:", err);
        res.end();
      });

      return driveResponse.data.pipe(res);
    }

    const positions = range.replace(/bytes=/, "").split("-");
    let start = parseInt(positions[0] || "0", 10);
    let end = positions[1] ? parseInt(positions[1], 10) : (size - 1);

    if (Number.isNaN(start) || start < 0) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start >= size) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`);
      return res.end();
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", String(chunkSize));
    res.setHeader("Content-Type", mime);

    const driveResponse = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream", headers: { Range: `bytes=${start}-${end}` } }
    );

    driveResponse.data.on("error", (err: any) => {
      console.error("Stream error:", err);
      res.end();
    });

    driveResponse.data.pipe(res);
  } catch (err) {
    console.error("Stream-fout:", err);
    res.status(500).send("Fout bij streamen");
  }
});

// Preflight support for stream endpoint
app.options("/stream/:id", (req, res) => {
  setStreamCorsHeaders(req, res);
  res.status(204).end();
});

// ✅ SPA fallback – sluit ook /api uit
app.get(/^\/(?!api|songs|stream).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"), (err) => {
    if (err) {
      console.error("Fout bij serveren index.html:", err);
      res.status(500).send("Fout bij laden van pagina");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});

// Error handler blijft onderaan
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});