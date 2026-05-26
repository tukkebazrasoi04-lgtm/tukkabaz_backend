import { Request, Response } from "express";

export const adminUploadMediaController = async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    // 👆 frontend sends: { image: "data:image/jpeg;base64,..." }

    if (!image) {
      return res.status(400).json({ message: "No image provided" });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const formData = new FormData();

    // ✅ IMPORTANT: send full data URI (not raw base64)
    formData.append("file", image);

    formData.append("upload_preset", "hero");
    formData.append("folder", "hero");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const data = await response.json();

    if (!data.secure_url) {
      return res.status(500).json({
        message: "Upload failed",
        error: data,
      });
    }

    return res.status(201).json({
      url: data.secure_url,
      public_id: data.public_id,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

export const adminDeleteImageController = async (req:Request, res:Response) => {
  try {
    const { public_id } = req.params;

    if (!public_id) {
      return res.status(400).json({ message: "public_id is required" });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          public_id,
        }),
      }
    );

    const data = await response.json();

    if (data.result !== "ok") {
      return res.status(400).json({ message: "Delete failed", data });
    }

    return res.json({
      message: "Image deleted successfully",
      public_id,
    });
  } catch (err) {
    return res.status(500).json({ message: err });
  }
};