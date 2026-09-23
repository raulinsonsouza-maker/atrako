import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Upgrades Facebook CDN thumbnail URLs (64x64, 128x128, 256x256, p64x64, etc.) to full resolution.
 * The CDN often returns small thumbnails; replacing the size segment can yield larger images.
 */
export function upgradeFbCdnImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/fbcdn\.net|facebook\.com/.test(trimmed)) return trimmed;
  // Upgrade common small sizes to 1080x1080
  const result = trimmed
    .replace(/\b64x64\b/g, "1080x1080")
    .replace(/\b128x128\b/g, "1080x1080")
    .replace(/\b256x256\b/g, "1080x1080")
    .replace(/\/p64x64\//g, "/p1080x1080/")
    .replace(/\/p128x128\//g, "/p1080x1080/")
    .replace(/\/p256x256\//g, "/p1080x1080/");
  return result;
}
