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

export function calcBenefits(
  salary: Decimal,
  unit: BargainingUnitConfig,
  yearConfig: YearConfig,
  yearIdx: number,
  insuranceElection: string
): BenefitResult {
  const grossUpRate = new Decimal(unit.retirementGrossUpRate);
  const retirementContribution = salary
    .times(grossUpRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let ficaCost: Decimal;
  if (unit.ficaExempt) {
    ficaCost = salary
      .times(MEDICARE_RATE)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    if (salary.lte(SS_WAGE_BASE)) {
      ficaCost = salary
        .times(FULL_FICA_RATE)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      const ssPart = SS_WAGE_BASE.times(SS_RATE);
      const medicarePart = salary.times(MEDICARE_RATE);
      ficaCost = ssPart
        .plus(medicarePart)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

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
  } else if (
    election === "single_plus_spouse" ||
    election === "single_plus_child"
  ) {
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
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const dentalCost = new Decimal(unit.dentalAnnual).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP
  );
  const lifeCost = salary
    .times("0.005")
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const disabilityCost = new Decimal(unit.disabilityInsuranceAnnual).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP
  );

  let hsaCost: Decimal;
  if (election === "family") {
    hsaCost = new Decimal(unit.hsaContributionFamily).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP
    );
  } else if (election !== "waived") {
    hsaCost = new Decimal(unit.hsaContributionSingle).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP
    );
  } else {
    hsaCost = new Decimal("0");
  }

  const workersCompCost = salary
    .times(unit.workersCompRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

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
