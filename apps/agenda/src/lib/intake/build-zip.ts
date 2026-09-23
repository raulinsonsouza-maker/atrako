import { readFileSync } from "fs";
import { resolveIntakeStoragePath } from "@/lib/intake/storage";

/** ZIP mínimo (store, sem compressão) — evita dependência externa. */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(d = new Date()) {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

function localFileHeader(
  name: string,
  data: Buffer,
  offset: number,
): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const { time, date } = dosTimeDate();
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuf, data]);
}

function centralDirEntry(
  name: string,
  data: Buffer,
  offset: number,
): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const { time, date } = dosTimeDate();
  const crc = crc32(data);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0, 8);
  entry.writeUInt16LE(0, 10);
  entry.writeUInt16LE(time, 12);
  entry.writeUInt16LE(date, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(data.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBuf.length, 28);
  entry.writeUInt16LE(0, 30);
  entry.writeUInt16LE(0, 32);
  entry.writeUInt16LE(0, 34);
  entry.writeUInt16LE(0, 36);
  entry.writeUInt32LE(0, 38);
  entry.writeUInt32LE(offset, 42);
  return Buffer.concat([entry, nameBuf]);
}

export type ZipEntry = { name: string; storagePath: string };

export function buildZipBuffer(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const absolute = resolveIntakeStoragePath(entry.storagePath);
    const data = readFileSync(absolute);
    const safeName = entry.name.replace(/\\/g, "/");
    parts.push(localFileHeader(safeName, data, offset));
    central.push(centralDirEntry(safeName, data, offset));
    offset += 30 + Buffer.byteLength(safeName, "utf8") + data.length;
  }

  const centralStart = offset;
  for (const c of central) {
    parts.push(c);
    offset += c.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.reduce((s, c) => s + c.length, 0), 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  parts.push(end);

  return Buffer.concat(parts);
}

export function sanitizeZipName(name: string) {
  return name.replace(/[^\w\s.\-()áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/g, "_");
}
