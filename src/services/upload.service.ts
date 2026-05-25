import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";

type UploadImageInput = {
  imageBase64: string;
  fileName?: string;
  folder?: string;
};

const inferMimeType = (fileName?: string): string => {
  const normalized = (fileName ?? "").toLowerCase();

  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
};

const normalizeBase64 = (raw: string): { base64: string; mimeType: string | null } => {
  const trimmed = raw.trim();
  const dataUriMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (dataUriMatch) {
    return {
      mimeType: dataUriMatch[1] ?? null,
      base64: (dataUriMatch[2] ?? "").trim()
    };
  }

  return {
    mimeType: null,
    base64: trimmed
  };
};

const getUploadMode = (): "signed" | "unsigned" => {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    throw new AppError(503, "CDN upload is not configured. Missing CLOUDINARY_CLOUD_NAME.");
  }

  if (env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    return "signed";
  }

  if (env.CLOUDINARY_UPLOAD_PRESET) {
    return "unsigned";
  }

  throw new AppError(
    503,
    "CDN upload is not configured. Set CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET or CLOUDINARY_UPLOAD_PRESET."
  );
};

class UploadService {
  async uploadImage(input: UploadImageInput): Promise<{ url: string; publicId: string }> {
    const mode = getUploadMode();
    const normalized = normalizeBase64(input.imageBase64);
    const mimeType = normalized.mimeType ?? inferMimeType(input.fileName);

    if (normalized.base64.length < 20) {
      throw new AppError(400, "Invalid image data");
    }

    const folder = (input.folder ?? env.CLOUDINARY_FOLDER).trim();
    const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
    const form = new FormData();

    form.append("file", `data:${mimeType};base64,${normalized.base64}`);
    form.append("folder", folder);

    if (mode === "signed") {
      const timestamp = Math.floor(Date.now() / 1000);
      const signaturePayload = `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
      const signature = crypto.createHash("sha1").update(signaturePayload).digest("hex");

      form.append("api_key", env.CLOUDINARY_API_KEY as string);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
    } else {
      form.append("upload_preset", env.CLOUDINARY_UPLOAD_PRESET as string);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      body: form
    });

    const payload = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.secure_url || !payload.public_id) {
      const message = payload.error?.message ?? "Image upload failed";
      throw new AppError(502, message);
    }

    return {
      url: payload.secure_url,
      publicId: payload.public_id
    };
  }
}

export const uploadService = new UploadService();
