import { exec } from "child_process";
import { inflateSync } from "zlib";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), ".uploads");

let _pythonCmd: string | null = null;
async function getPython(): Promise<string> {
  if (_pythonCmd) return _pythonCmd;
  return new Promise((resolve) => {
    exec("which python3 2>/dev/null || which python 2>/dev/null", (_err, stdout) => {
      _pythonCmd = stdout.trim() || "python3";
      resolve(_pythonCmd);
    });
  });
}

export function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Extracts text from a PDF buffer using Node.js builtins only (zlib + regex).
 * Works for standard text-based PDFs. No npm packages, no Python required.
 */
export function extractPdfText(buf: Buffer): string {
  const binary = buf.toString("binary");
  const allContent: string[] = [];

  // Split on stream markers and attempt zlib decompression on each
  const parts = binary.split(/stream\r?\n/);
  for (let i = 1; i < parts.length; i++) {
    const endIdx = parts[i].indexOf("\nendstream");
    if (endIdx === -1) continue;
    const raw = parts[i].substring(0, endIdx);
    try {
      const decompressed = inflateSync(Buffer.from(raw, "binary")).toString("binary");
      allContent.push(decompressed);
    } catch {
      allContent.push(raw);
    }
  }
  // Also scan the raw structure for any uncompressed inline text
  allContent.push(binary);

  const texts: string[] = [];

  for (const content of allContent) {
    // Single string: (text) Tj
    const tjRe = /\(([^\\)]*(?:\\.[^\\)]*)*)\)\s*(?:Tj|'|")/g;
    let m: RegExpExecArray | null;
    while ((m = tjRe.exec(content)) !== null) {
      const t = decodePdfStr(m[1]).trim();
      if (t.length > 1) texts.push(t);
    }

    // Array: [(text) -num (text)] TJ
    const tjArrRe = /\[((?:[^\[\]]|\((?:[^()\\]|\\.)*\))*)\]\s*TJ/g;
    while ((m = tjArrRe.exec(content)) !== null) {
      const strRe = /\(([^)]*)\)/g;
      let s: RegExpExecArray | null;
      const parts2: string[] = [];
      while ((s = strRe.exec(m[1])) !== null) {
        const t = decodePdfStr(s[1]).trim();
        if (t) parts2.push(t);
      }
      if (parts2.length) texts.push(parts2.join(""));
    }
  }

  if (texts.length === 0) {
    throw new Error("No text extracted — PDF may be a scanned image. Upload a text-based PDF.");
  }

  return texts.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfStr(s: string): string {
  return s
    .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ");
}

export async function executePythonModel(pythonCode: string): Promise<Buffer> {
  ensureUploadDir();
  const jobId = randomUUID();
  const scriptPath = join("/tmp", `bp_model_${jobId}.py`);
  const outputPath = join("/tmp", `bp_output_${jobId}.xlsx`);

  const adjustedCode = pythonCode
    .replace(/```python\n?/g, "")
    .replace(/```\n?/g, "")
    .replaceAll("/tmp/output.xlsx", outputPath);

  writeFileSync(scriptPath, adjustedCode, "utf-8");

  const python = await getPython();
  return new Promise((resolve, reject) => {
    exec(
      `"${python}" ${scriptPath}`,
      { timeout: 150_000, maxBuffer: 50 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        try { unlinkSync(scriptPath); } catch {}
        if (error) {
          try { unlinkSync(outputPath); } catch {}
          reject(new Error(`Python execution failed: ${stderr || error.message}`));
          return;
        }
        try {
          const buf = readFileSync(outputPath);
          try { unlinkSync(outputPath); } catch {}
          resolve(buf);
        } catch {
          reject(new Error("Excel output file was not generated"));
        }
      }
    );
  });
}

export function saveFile(buffer: Buffer, filename: string): string {
  ensureUploadDir();
  const dest = join(UPLOAD_DIR, filename);
  writeFileSync(dest, buffer);
  return dest;
}

export function readFile(filePath: string): Buffer {
  return readFileSync(filePath);
}
