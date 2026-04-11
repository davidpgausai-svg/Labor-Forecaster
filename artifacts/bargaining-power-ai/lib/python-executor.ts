import { exec } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), ".uploads");

export function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
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

  return new Promise((resolve, reject) => {
    exec(
      `python3 ${scriptPath}`,
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
