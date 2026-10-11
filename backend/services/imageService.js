import sharp from "sharp";

/** Fix rotation, cap size, return { data: Buffer, mime } */
export async function loadImage(filePath) {
  const data = await sharp(filePath)
    .rotate() // respects EXIF orientation
    .resize({ width: 2600, height: 2600, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { data, mime: "image/jpeg" };
}