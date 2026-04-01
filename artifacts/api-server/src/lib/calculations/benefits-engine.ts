import Decimal from "decimal.js";
import type { BargainingUnitConfig, YearConfig } from "./types";

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

  // FICA / Medicare — computed on pro-rated salary, naturally scaled
  let ficaCost: Decimal;
  if (unit.ficaExempt) {
    ficaCost = salary.times(MEDICARE_RATE).toDecimalPlaces(2, TWO);
  } else {
    if (salary.lte(SS_WAGE_BASE)) {
      ficaCost = salary.times(FULL_FICA_RATE).toDecimalPlaces(2, TWO);
    } else {
      // SS portion only up to wage base (capped at proRated share of base)
      const proRatedWageBase = SS_WAGE_BASE.times(proRateFraction);
      const ssPart = proRatedWageBase.times(SS_RATE);
      const medicarePart = salary.times(MEDICARE_RATE);
      ficaCost = ssPart.plus(medicarePart).toDecimalPlaces(2, TWO);
    }
  }

  // Health insurance: compound annually for cost growth, then pro-rate for partial year
  const healthIncreaseRate = yearConfig.healthPremiumIncreaseRate
    ? new Decimal(yearConfig.healthPremiumIncreaseRate)
    : new Decimal("0.05");
  const healthCapRate = yearConfig.healthEmployerCapRate
    ? new Decimal(yearConfig.healthEmployerCapRate)
    : new Decimal("0.08");

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

  // Flat annual health cost — pro-rated for partial year
  const healthInsuranceCost = healthBase
    .times(healthMultiplier)
    .times(proRateFraction)
    .toDecimalPlaces(2, TWO);

  // Flat annual benefits — pro-rated for partial year
  const dentalCost = new Decimal(unit.dentalAnnual)
    .times(proRateFraction)
    .toDecimalPlaces(2, TWO);

  // Life insurance: % of salary, salary already pro-rated
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

  // Workers comp: % of salary, salary already pro-rated
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
 * Assumes fiscal year starts July 1. Full year → Decimal("1").
 */
export function calcProRateFraction(
  effectiveDate?: string | null,
  terminationDate?: string | null
): Decimal {
  if (!effectiveDate && !terminationDate) return new Decimal("1");

  let workDays = FISCAL_YEAR_DAYS;

  if (effectiveDate) {
    const startDate = new Date(effectiveDate);
    const yearStart = new Date(startDate.getFullYear(), 6, 1); // July 1
    const daysSinceYearStart = Math.max(
      0,
      Math.floor((startDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    workDays = Math.max(0, FISCAL_YEAR_DAYS - daysSinceYearStart);
  }

  if (terminationDate) {
    const endDate = new Date(terminationDate);
    const yearStart = new Date(endDate.getFullYear(), 6, 1); // July 1
    const daysWorked = Math.max(
      0,
      Math.floor((endDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    workDays = Math.min(workDays, daysWorked);
  }

  return new Decimal(workDays).dividedBy(FISCAL_YEAR_DAYS);
}
