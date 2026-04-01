import Decimal from "decimal.js";
import type { BargainingUnitConfig, YearConfig } from "./types.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const SS_WAGE_BASE = new Decimal("176100");
const MEDICARE_RATE = new Decimal("0.0145");
const SS_RATE = new Decimal("0.062");
const FULL_FICA_RATE = new Decimal("0.0765");

export interface BenefitResult {
  retirementContribution: Decimal;
  ficaCost: Decimal;
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
 * Calculate employer benefit costs for one employee in one contract year.
 *
 * proRateFraction — fraction of the fiscal year the employee was employed (0–1).
 * Applied to FLAT-dollar benefits (health, dental, disability, HSA) since those
 * are annual costs that scale with employment time.
 * Percentage-based costs (retirement/TRS, FICA, workers comp, life insurance)
 * are computed as a % of salary — the salary itself is already pro-rated before
 * it arrives here, so no additional proRateFraction is needed on those lines.
 */
export function calcBenefits(
  salary: Decimal,
  unit: BargainingUnitConfig,
  yearConfig: YearConfig,
  yearIdx: number,
  insuranceElection: string,
  proRateFraction: Decimal = new Decimal("1")
): BenefitResult {
  const TWO = Decimal.ROUND_HALF_UP;

  // TRS/IMRF retirement gross-up — salary is already pro-rated, no double pro-rate
  const grossUpRate = new Decimal(unit.retirementGrossUpRate);
  const retirementContribution = salary
    .times(grossUpRate)
    .toDecimalPlaces(2, TWO);

  // FICA / Medicare — computed on pro-rated salary, naturally scaled.
  // For partial-year employees, the SS wage-base cap must also be prorated so that an
  // employee who earns below the FULL annual base but above the PRORATED base is not
  // overcharged on Social Security.
  let ficaCost: Decimal;
  if (unit.ficaExempt) {
    ficaCost = salary.times(MEDICARE_RATE).toDecimalPlaces(2, TWO);
  } else {
    const proRatedWageBase = SS_WAGE_BASE.times(proRateFraction);
    if (salary.lte(proRatedWageBase)) {
      ficaCost = salary.times(FULL_FICA_RATE).toDecimalPlaces(2, TWO);
    } else {
      const ssPart = proRatedWageBase.times(SS_RATE);
      const medicarePart = salary.times(MEDICARE_RATE);
      ficaCost = ssPart.plus(medicarePart).toDecimalPlaces(2, TWO);
    }
  }

  // Health insurance: compound annually for cost growth, then pro-rate for partial year
  const healthIncreaseRate = yearConfig.healthPremiumIncreaseRate
    ? new Decimal(yearConfig.healthPremiumIncreaseRate)
    : new Decimal("5");
  const healthCapRate = yearConfig.healthEmployerCapRate
    ? new Decimal(yearConfig.healthEmployerCapRate)
    : new Decimal("8");

  const actualIncreaseRate = Decimal.min(healthIncreaseRate, healthCapRate);
  const healthMultiplier = new Decimal("1")
    .plus(actualIncreaseRate.dividedBy(100))
    .pow(yearIdx);

  let healthBase: Decimal;
  const election = insuranceElection;
  if (election === "family") {
    healthBase = new Decimal(unit.healthInsuranceFamilyAnnual);
  } else if (election === "single_plus_spouse" || election === "single_plus_child") {
    const single = new Decimal(unit.healthInsuranceSingleAnnual);
    const family = new Decimal(unit.healthInsuranceFamilyAnnual);
    healthBase = single.plus(family.minus(single).times("0.5"));
  } else if (election === "waived") {
    healthBase = new Decimal("0");
  } else {
    healthBase = new Decimal(unit.healthInsuranceSingleAnnual);
  }

  const healthInsuranceCost = healthBase
    .times(healthMultiplier)
    .times(proRateFraction)
    .toDecimalPlaces(2, TWO);

  const dentalCost = new Decimal(unit.dentalAnnual)
    .times(proRateFraction)
    .toDecimalPlaces(2, TWO);

  const lifeCost = salary.times("0.005").toDecimalPlaces(2, TWO);

  const disabilityCost = new Decimal(unit.disabilityInsuranceAnnual)
    .times(proRateFraction)
    .toDecimalPlaces(2, TWO);

  let hsaCost: Decimal;
  if (election === "family") {
    hsaCost = new Decimal(unit.hsaContributionFamily)
      .times(proRateFraction)
      .toDecimalPlaces(2, TWO);
  } else if (election !== "waived") {
    hsaCost = new Decimal(unit.hsaContributionSingle)
      .times(proRateFraction)
      .toDecimalPlaces(2, TWO);
  } else {
    hsaCost = new Decimal("0");
  }

  const workersCompCost = salary.times(unit.workersCompRate).toDecimalPlaces(2, TWO);

  const otherBenefitsCost = dentalCost
    .plus(lifeCost)
    .plus(disabilityCost)
    .plus(hsaCost)
    .plus(workersCompCost);

  const totalEmployerCost = salary
    .plus(retirementContribution)
    .plus(ficaCost)
    .plus(healthInsuranceCost)
    .plus(otherBenefitsCost);

  return {
    retirementContribution,
    ficaCost,
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
