import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { db, uploadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// Store uploads in /tmp for the session; cleared on restart
const UPLOAD_DIR = "/tmp/pappy-pfp-uploads";

// Ensure upload dir exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
    }
  },
});

router.post("/pfp/upload", upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided." });
    return;
  }

  try {
    const file = req.file;
    const id = uuidv4();

    // Read image metadata with sharp
    const meta = await sharp(file.path).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    let orientation: "portrait" | "landscape" | "square";
    if (width === height) orientation = "square";
    else if (height > width) orientation = "portrait";
    else orientation = "landscape";

    // Quality score heuristic based on resolution
    const pixels = width * height;
    let qualityScore: number;
    if (pixels >= 1_000_000) qualityScore = 95;
    else if (pixels >= 500_000) qualityScore = 80;
    else if (pixels >= 250_000) qualityScore = 65;
    else if (pixels >= 100_000) qualityScore = 45;
    else qualityScore = 25;

    // Generate base64 data URL thumbnail (small, for preview)
    const thumbnailBuffer = await sharp(file.path)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString("base64")}`;

    // Persist to DB
    await db.insert(uploadsTable).values({
      id,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      width,
      height,
      orientation,
      qualityScore,
      dataUrl,
    });

    req.log.info({ id, width, height }, "Image uploaded");

    res.json({
      id,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      width,
      height,
      orientation,
      qualityScore,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Upload failed");
    // Clean up temp file on error
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(400).json({ error: "Failed to process image." });
  }
});

router.get("/pfp/uploads/:uploadId", async (req, res): Promise<void> => {
  const uploadId = Array.isArray(req.params.uploadId) ? req.params.uploadId[0] : req.params.uploadId;

  const [upload] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, uploadId))
    .limit(1);

  if (!upload) {
    res.status(404).json({ error: "Upload not found." });
    return;
  }

  res.json({
    id: upload.id,
    filename: upload.filename,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    width: upload.width,
    height: upload.height,
    orientation: upload.orientation,
    qualityScore: upload.qualityScore,
    dataUrl: upload.dataUrl,
    createdAt: upload.createdAt.toISOString(),
  });
});

router.delete("/pfp/uploads/:uploadId", async (req, res): Promise<void> => {
  const uploadId = Array.isArray(req.params.uploadId) ? req.params.uploadId[0] : req.params.uploadId;

  const [upload] = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, uploadId))
    .limit(1);

  if (upload) {
    // Delete the file from disk
    const filePath = `${UPLOAD_DIR}/${upload.filename}`;
    await fs.unlink(filePath).catch((e) => {
      logger.warn({ e, filePath }, "Could not delete upload file");
    });

    // Remove from DB
    await db.delete(uploadsTable).where(eq(uploadsTable.id, uploadId));
  }

  res.json({ success: true, message: "Upload deleted." });
});

export default router;
