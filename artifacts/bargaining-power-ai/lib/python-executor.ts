import { exec } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

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

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  return result.text.trim();
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
