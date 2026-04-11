import { exec } from "child_process";
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

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const jobId = randomUUID();
  const pdfPath = join("/tmp", `bp_pdf_${jobId}.pdf`);
  const txtPath = join("/tmp", `bp_txt_${jobId}.txt`);

  writeFileSync(pdfPath, pdfBuffer);

  const script = `
import sys, subprocess

def try_install(pkg):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def extract(pdf_path, txt_path):
    # Try pypdf
    try:
        import pypdf
    except ImportError:
        try_install("pypdf")
        try:
            import pypdf
        except ImportError:
            pypdf = None

    if pypdf is not None:
        try:
            reader = pypdf.PdfReader(pdf_path)
            pages = len(reader.pages)
            text = ""
            for page in reader.pages:
                text += (page.extract_text() or "") + "\\n"
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"PAGES:{pages}\\n" + text)
            return
        except Exception as e:
            pass

    # Try pdfminer.six
    try:
        from pdfminer.high_level import extract_text
    except ImportError:
        try_install("pdfminer.six")
        try:
            from pdfminer.high_level import extract_text
        except ImportError:
            raise RuntimeError("No PDF extraction library available (tried pypdf, pdfminer.six)")

    text = extract_text(pdf_path)
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("PAGES:0\\n" + text)

extract(sys.argv[1], sys.argv[2])
`.trim();

  const scriptPath = join("/tmp", `bp_pdfext_${jobId}.py`);
  writeFileSync(scriptPath, script, "utf-8");

  const python = await getPython();
  return new Promise((resolve, reject) => {
    exec(
      `"${python}" "${scriptPath}" "${pdfPath}" "${txtPath}"`,
      { timeout: 60_000 },
      (error, _stdout, stderr) => {
        try { unlinkSync(scriptPath); } catch {}
        try { unlinkSync(pdfPath); } catch {}
        if (error) {
          try { unlinkSync(txtPath); } catch {}
          reject(new Error(`PDF extraction failed: ${stderr || error.message}`));
          return;
        }
        try {
          const raw = readFileSync(txtPath, "utf-8");
          unlinkSync(txtPath);
          // Strip the PAGES: header line
          const text = raw.replace(/^PAGES:\d+\n/, "");
          resolve(text.trim());
        } catch {
          reject(new Error("PDF text output file was not created"));
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
