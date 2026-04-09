import Decimal from "decimal.js";
import type { BargainingUnitConfig, YearConfig, EmployerCostConfig } from "./types.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

// Hardcoded fallback constants (used when no normalized tax config is present)
const DEFAULT_SS_WAGE_BASE = new Decimal("176100");
const DEFAULT_MEDICARE_RATE = new Decimal("0.0145");
const DEFAULT_SS_RATE = new Decimal("0.062");
const DEFAULT_FUTA_RATE = new Decimal("0.006");
const DEFAULT_FUTA_WAGE_BASE = new Decimal("7000");
const DEFAULT_SUTA_RATE = new Decimal("0.027");
const DEFAULT_SUTA_WAGE_BASE = new Decimal("13000");

export interface BenefitResult {
  retirementContribution: Decimal;
  ficaCost: Decimal;
  futaCost: Decimal;
  sutaCost: Decimal;
  healthInsuranceCost: Decimal;
  dentalCost: Decimal;
  lifeCost: Decimal;
  disabilityCost: Decimal;
  hsaCost: Decimal;
  workersCompCost: Decimal;
  otherBenefitsCost: Decimal;
  totalEmployerCost: Decimal;
}

/**
 * Map an insurance election value to a benefit tier key.
 */
function electionToTier(election: string): string {
  switch (election) {
    case "single": return "ee_only";
    case "single_plus_spouse": return "ee_spouse";
    case "single_plus_child": return "ee_child";
    case "family": return "family";
    default: return "waived";
  }
}

/**
 * Calculate employer benefit costs for one employee in one contract year.
 *
 * When employerCostConfig is provided and has data, it takes precedence over
 * BargainingUnitConfig flat fields. Falls back to flat fields when normalized
 * data is absent (e.g., before the migration script has been run).
 *
 * proRateFraction — fraction of the fiscal year the employee was employed (0–1).
 * Applied to FLAT-dollar benefits (health, dental, disability, HSA, flat costs).
 * Percentage-based costs (retirement/TRS, FICA, workers comp, life insurance)
 * are computed on the already-pro-rated salary — no additional fraction needed.
 */
export function calcBenefits(
  salary: Decimal,
  unit: BargainingUnitConfig,
  yearConfig: YearConfig,
  yearIdx: number,
  insuranceElection: string,
  proRateFraction: Decimal = new Decimal("1"),
  employerCostConfig: EmployerCostConfig | null = null
): BenefitResult {
  const TWO = Decimal.ROUND_HALF_UP;
  const ZERO = new Decimal("0");

  const taxCfg = employerCostConfig?.taxConfig ?? null;
  const retPlan = employerCostConfig?.retirementPlan ?? null;

  // ── Effective rates (normalized → fallback to flat fields) ───────────────
  const grossUpRate = new Decimal(retPlan?.grossUpRate ?? unit.retirementGrossUpRate);
  const ficaExempt = retPlan ? retPlan.isFicaExempt : unit.ficaExempt;

  const ssWageBase = taxCfg ? new Decimal(taxCfg.ssWageBase) : DEFAULT_SS_WAGE_BASE;
  const medicareRate = taxCfg ? new Decimal(taxCfg.medicareRate) : DEFAULT_MEDICARE_RATE;
  const ssRate = taxCfg ? new Decimal(taxCfg.ssRate) : DEFAULT_SS_RATE;
  const fullFicaRate = ssRate.plus(medicareRate);
  const futaRate = taxCfg ? new Decimal(taxCfg.futaRate) : DEFAULT_FUTA_RATE;
  const futaWageBase = taxCfg ? new Decimal(taxCfg.futaWageBase) : DEFAULT_FUTA_WAGE_BASE;
  const sutaRate = taxCfg ? new Decimal(taxCfg.sutaRate) : DEFAULT_SUTA_RATE;
  const sutaWageBase = taxCfg ? new Decimal(taxCfg.sutaWageBase) : DEFAULT_SUTA_WAGE_BASE;
  // workersCompRate: normalized table stores per-$100, flat field is already a rate
  const wcRate = taxCfg
    ? new Decimal(taxCfg.workersCompRatePer100).dividedBy("100")
    : new Decimal(unit.workersCompRate);

  // ── Retirement gross-up ────────────────────────────────────────────────────
  const retirementContribution = salary.times(grossUpRate).toDecimalPlaces(2, TWO);

  // ── FICA / Medicare ───────────────────────────────────────────────────────
  let ficaCost: Decimal;
  if (ficaExempt) {
    ficaCost = salary.times(medicareRate).toDecimalPlaces(2, TWO);
  } else {
    const proRatedWageBase = ssWageBase.times(proRateFraction);
    if (salary.lte(proRatedWageBase)) {
      ficaCost = salary.times(fullFicaRate).toDecimalPlaces(2, TWO);
    } else {
      const ssPart = proRatedWageBase.times(ssRate);
      const medicarePart = salary.times(medicareRate);
      ficaCost = ssPart.plus(medicarePart).toDecimalPlaces(2, TWO);
    }
  }

  // ── FUTA ──────────────────────────────────────────────────────────────────
  const futaTaxable = Decimal.min(salary, futaWageBase.times(proRateFraction));
  const futaCost = futaTaxable.times(futaRate).toDecimalPlaces(2, TWO);

  // ── SUTA ──────────────────────────────────────────────────────────────────
  const sutaTaxable = Decimal.min(salary, sutaWageBase.times(proRateFraction));
  const sutaCost = sutaTaxable.times(sutaRate).toDecimalPlaces(2, TWO);

  // ── Workers compensation ──────────────────────────────────────────────────
  const workersCompCost = salary.times(wcRate).toDecimalPlaces(2, TWO);

  // ── Benefit trend rate ────────────────────────────────────────────────────
  // benefitCostTrendRate takes precedence over healthPremiumIncreaseRate
  const trendRateSource = yearConfig.benefitCostTrendRate ?? yearConfig.healthPremiumIncreaseRate;
  const healthIncreaseRate = trendRateSource ? new Decimal(trendRateSource) : new Decimal("5");
  const healthCapRate = yearConfig.healthEmployerCapRate
    ? new Decimal(yearConfig.healthEmployerCapRate)
    : new Decimal("8");
  const actualIncreaseRate = Decimal.min(healthIncreaseRate, healthCapRate);
  const benefitMultiplier = new Decimal("1")
    .plus(actualIncreaseRate.dividedBy(100))
    .pow(yearIdx);

  // ── Health insurance ──────────────────────────────────────────────────────
  let healthInsuranceCost: Decimal;
  const healthPlan = employerCostConfig?.benefitPlans.find((p) => p.category === "health");
  if (healthPlan) {
    const tier = electionToTier(insuranceElection);
    if (tier === "waived") {
      healthInsuranceCost = ZERO;
    } else {
      const tierData =
        healthPlan.tiers.find((t) => t.tier === tier) ??
        healthPlan.tiers.find((t) => t.tier === "ee_only");
      const healthBase = new Decimal(tierData?.employerContributionAnnual ?? "0");
      healthInsuranceCost = healthBase
        .times(benefitMultiplier)
        .times(proRateFraction)
        .toDecimalPlaces(2, TWO);
    }
  } else {
    // Fallback to flat fields
    const healthIncRate = trendRateSource ? new Decimal(trendRateSource) : new Decimal("5");
    const healthCapRt = yearConfig.healthEmployerCapRate
      ? new Decimal(yearConfig.healthEmployerCapRate)
      : new Decimal("8");
    const actRate = Decimal.min(healthIncRate, healthCapRt);
    const multiplier = new Decimal("1").plus(actRate.dividedBy(100)).pow(yearIdx);
    let healthBase: Decimal;
    if (insuranceElection === "family") {
      healthBase = new Decimal(unit.healthInsuranceFamilyAnnual);
    } else if (
      insuranceElection === "single_plus_spouse" ||
      insuranceElection === "single_plus_child"
    ) {
      const single = new Decimal(unit.healthInsuranceSingleAnnual);
      const family = new Decimal(unit.healthInsuranceFamilyAnnual);
      healthBase = single.plus(family.minus(single).times("0.5"));
    } else if (insuranceElection === "waived") {
      healthBase = ZERO;
    } else {
      healthBase = new Decimal(unit.healthInsuranceSingleAnnual);
    }
    healthInsuranceCost = healthBase.times(multiplier).times(proRateFraction).toDecimalPlaces(2, TWO);
  }

  // ── Dental ────────────────────────────────────────────────────────────────
  let dentalCost: Decimal;
  const dentalPlan = employerCostConfig?.benefitPlans.find((p) => p.category === "dental");
  if (dentalPlan) {
    if (insuranceElection === "waived") {
      dentalCost = ZERO;
    } else {
      const tier = electionToTier(insuranceElection);
      const tierData =
        dentalPlan.tiers.find((t) => t.tier === tier) ??
        dentalPlan.tiers.find((t) => t.tier === "ee_only") ??
        dentalPlan.tiers[0];
      dentalCost = tierData
        ? new Decimal(tierData.employerContributionAnnual)
            .times(proRateFraction)
            .toDecimalPlaces(2, TWO)
        : ZERO;
    }
  } else {
    dentalCost = new Decimal(unit.dentalAnnual)
      .times(proRateFraction)
      .toDecimalPlaces(2, TWO);
  }

  // ── Life insurance ────────────────────────────────────────────────────────
  let lifeCost: Decimal;
  const lifePlan = employerCostConfig?.benefitPlans.find(
    (p) => p.category === "life" || p.category === "add"
  );
  if (lifePlan) {
    if (lifePlan.calculationMethod === "percent_of_salary" && lifePlan.salaryRate) {
      const capSalary = lifePlan.coveredEarningsCap
        ? Decimal.min(salary, new Decimal(lifePlan.coveredEarningsCap))
        : salary;
      lifeCost = capSalary
        .times(new Decimal(lifePlan.salaryRate).dividedBy("100"))
        .toDecimalPlaces(2, TWO);
    } else if (
      (lifePlan.calculationMethod === "rate_per_100" ||
        lifePlan.calculationMethod === "rate_per_1000") &&
      lifePlan.salaryRate
    ) {
      const divisor = lifePlan.calculationMethod === "rate_per_100" ? "100" : "1000";
      const capSalary = lifePlan.coveredEarningsCap
        ? Decimal.min(salary, new Decimal(lifePlan.coveredEarningsCap))
        : salary;
      lifeCost = capSalary
        .dividedBy(divisor)
        .times(new Decimal(lifePlan.salaryRate))
        .toDecimalPlaces(2, TWO);
    } else {
      // flat_dollar life — use ee_only tier
      const tierData = lifePlan.tiers.find((t) => t.tier === "ee_only") ?? lifePlan.tiers[0];
      lifeCost = tierData
        ? new Decimal(tierData.employerContributionAnnual).toDecimalPlaces(2, TWO)
        : ZERO;
    }
  } else {
    // Fallback: 0.5% of salary (legacy default)
    lifeCost = salary.times("0.005").toDecimalPlaces(2, TWO);
  }

  // ── Disability (LTD/STD) ──────────────────────────────────────────────────
  let disabilityCost: Decimal;
  const disabilityPlan = employerCostConfig?.benefitPlans.find(
    (p) => p.category === "ltd" || p.category === "std" || p.category === "disability"
  );
  if (disabilityPlan) {
    if (
      (disabilityPlan.calculationMethod === "percent_of_salary" ||
        disabilityPlan.calculationMethod === "rate_per_100" ||
        disabilityPlan.calculationMethod === "rate_per_1000") &&
      disabilityPlan.salaryRate
    ) {
      const divisor =
        disabilityPlan.calculationMethod === "percent_of_salary"
          ? "100"
          : disabilityPlan.calculationMethod === "rate_per_1000"
          ? "1000"
          : "100";
      const capSalary = disabilityPlan.coveredEarningsCap
        ? Decimal.min(salary, new Decimal(disabilityPlan.coveredEarningsCap))
        : salary;
      disabilityCost = capSalary
        .dividedBy(divisor)
        .times(new Decimal(disabilityPlan.salaryRate))
        .times(proRateFraction)
        .toDecimalPlaces(2, TWO);
    } else {
      const tierData =
        disabilityPlan.tiers.find((t) => t.tier === "ee_only") ?? disabilityPlan.tiers[0];
      disabilityCost = tierData
        ? new Decimal(tierData.employerContributionAnnual)
            .times(proRateFraction)
            .toDecimalPlaces(2, TWO)
        : ZERO;
    }
  } else {
    disabilityCost = new Decimal(unit.disabilityInsuranceAnnual)
      .times(proRateFraction)
      .toDecimalPlaces(2, TWO);
  }

  // ── HSA / HRA ─────────────────────────────────────────────────────────────
  let hsaCost: Decimal;
  if (employerCostConfig?.hsaContributions && employerCostConfig.hsaContributions.length > 0) {
    const tier = electionToTier(insuranceElection);
    if (tier === "waived") {
      hsaCost = ZERO;
    } else {
      const contrib =
        employerCostConfig.hsaContributions.find((h) => h.tier === tier) ??
        employerCostConfig.hsaContributions.find((h) => h.tier === "ee_only");
      hsaCost = contrib
        ? new Decimal(contrib.annualContribution).times(proRateFraction).toDecimalPlaces(2, TWO)
        : ZERO;
    }
  } else {
    if (insuranceElection === "family") {
      hsaCost = new Decimal(unit.hsaContributionFamily)
        .times(proRateFraction)
        .toDecimalPlaces(2, TWO);
    } else if (insuranceElection !== "waived") {
      hsaCost = new Decimal(unit.hsaContributionSingle)
        .times(proRateFraction)
        .toDecimalPlaces(2, TWO);
    } else {
      hsaCost = ZERO;
    }
  }

  // ── Flat per-employee costs (EAP, wellness, etc.) ─────────────────────────
  let flatCosts = ZERO;
  if (employerCostConfig?.flatCosts && employerCostConfig.flatCosts.length > 0) {
    for (const fc of employerCostConfig.flatCosts) {
      flatCosts = flatCosts.plus(
        new Decimal(fc.annualCostPerEmployee).times(proRateFraction)
      );
    }
    flatCosts = flatCosts.toDecimalPlaces(2, TWO);
  }

  const otherBenefitsCost = dentalCost
    .plus(lifeCost)
    .plus(disabilityCost)
    .plus(hsaCost)
    .plus(workersCompCost)
    .plus(flatCosts);

  const totalEmployerCost = salary
    .plus(retirementContribution)
    .plus(ficaCost)
    .plus(futaCost)
    .plus(sutaCost)
    .plus(healthInsuranceCost)
    .plus(otherBenefitsCost);

  return {
    retirementContribution,
    ficaCost,
    futaCost,
    sutaCost,
    healthInsuranceCost,
    dentalCost,
    lifeCost,
    disabilityCost,
    hsaCost,
    workersCompCost,
    otherBenefitsCost,
    totalEmployerCost,
  };
}

const FISCAL_YEAR_DAYS = 260;

/**
 * Compute pro-rate fraction (0–1) based on employment dates within the fiscal year.
 * Assumes fiscal year starts July 1 of each year. Full year → Decimal("1").
 *
 * For Illinois K-12 districts, the fiscal year is July 1 – June 30.
 * - effectiveDate: when the employee started (mid-year hire → partial year)
 * - terminationDate: when the employee ends (mid-year termination → partial year)
 *
 * The fiscal year start is inferred from the date: if the month is July or later
 * (month >= 6 in 0-indexed), fiscal year started that same calendar year.
 * If month is January–June (month < 6), fiscal year started in the prior year.
 */
export function calcProRateFraction(
  effectiveDate?: string | null,
  terminationDate?: string | null
): Decimal {
  if (!effectiveDate && !terminationDate) return new Decimal("1");

  let workDays = FISCAL_YEAR_DAYS;

  if (effectiveDate) {
    const startDate = new Date(effectiveDate);
    // Fiscal year starts July 1. For a hire in Jan–Jun (month < 6 in 0-indexed), the
    // current fiscal year started July 1 of the PRIOR calendar year. We compute days
    // since that July 1 so that partial-year hires get a correct fraction.
    const startMonth = startDate.getMonth();
    const fyStartYear = startMonth < 6 ? startDate.getFullYear() - 1 : startDate.getFullYear();
    const yearStart = new Date(fyStartYear, 6, 1); // July 1 of fiscal-year start
    const daysSinceYearStart = Math.max(
      0,
      Math.floor((startDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    workDays = Math.max(0, FISCAL_YEAR_DAYS - daysSinceYearStart);
  }

  if (terminationDate) {
    const endDate = new Date(terminationDate);
    // If termination is Jan–Jun (month < 6), the fiscal year started in the PRIOR year
    // (e.g., termination on Jan 15, 2026 → fiscal year started July 1, 2025).
    // If termination is Jul–Dec (month >= 6), fiscal year started in the same year.
    const fyStartYear =
      endDate.getMonth() < 6 ? endDate.getFullYear() - 1 : endDate.getFullYear();
    const yearStart = new Date(fyStartYear, 6, 1);
    const daysWorked = Math.max(
      0,
      Math.floor((endDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    workDays = Math.min(workDays, daysWorked);
  }

  return new Decimal(workDays).dividedBy(FISCAL_YEAR_DAYS);
}
