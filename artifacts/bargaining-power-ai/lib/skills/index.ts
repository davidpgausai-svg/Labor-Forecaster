import { readFileSync } from "fs";
import { join } from "path";

const dir = join(process.cwd(), "lib", "skills");

function load(filename: string): string {
  return readFileSync(join(dir, filename), "utf-8");
}

export function getExtractionSystemPrompt(): string {
  return [
    load("SKILL.md"),
    load("DOMAIN-CBA-INTERPRETATION.md"),
  ].join("\n\n---\n\n");
}

export function getModelingSystemPrompt(): string {
  return [
    load("SKILL.md"),
    load("DOMAIN-CBA-INTERPRETATION.md"),
    load("DOMAIN-RETIREMENT-SYSTEMS.md"),
    load("DOMAIN-BENEFITS-MODELING.md"),
    load("DOMAIN-PAYROLL-TAXES.md"),
    load("DOMAIN-LEAVE-COSTS.md"),
    load("DOMAIN-WORKFORCE-SIMULATION.md"),
    load("OUTPUT-EXCEL-SPEC.md"),
    load("OUTPUT-INCREMENTAL-COST.md"),
    load("MERGE-PATCHES.md"),
    load("OUTPUT-SCENARIO-COMPARISON.md"),
    load("OUTPUT-REPORT-CUSTOMIZATION.md"),
  ].join("\n\n---\n\n");
}
