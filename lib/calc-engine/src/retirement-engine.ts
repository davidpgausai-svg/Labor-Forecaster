import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const RETIREMENT_RATE = new Decimal("5.5");
const TRS_6PCT_CAP = new Decimal("6.0");
const LONGEVITY_RATE = new Decimal("275");
const LONGEVITY_MAX_YEARS = 35;
const OPT2_SERVICE_BONUS = new Decimal("275");
const OPT2_TRS_BONUS = new Decimal("1000");
const OPT2_INSURANCE_BONUS = new Decimal("2500");
const OPT2_INSURANCE_YEARS = 4;

export interface RetirementOption1 {
  option: "option1_4year";
  eligible: boolean;
  currentSalary: string;
  year1Salary: string;
  year2Salary: string;
  year3Salary: string;
  year4Salary: string;
  totalSalaryCost: string;
  trsCapWarning: boolean;
}

export interface RetirementOption2 {
  option: "option2_2year";
  eligible: boolean;
  currentSalary: string;
  year1Salary: string;
  year2Salary: string;
  postRetirementServiceBonus: string;
  postRetirementTrsBonus: string;
  postRetirementInsuranceBonus: string;
  postRetirementTotal: string;
  totalCostToDistrict: string;
  trsCapWarning: boolean;
}

export interface RetirementOption3 {
  option: "option3_longevity";
  eligible: boolean;
  yearsInDistrict: number;
  longevityBonus: string;
  salaryWithBonus: string;
  trsCapWarning: boolean;
}

export function calcRetirementOption1(
  currentSalary: string,
  yearsInDistrict: number,
  yearsTotalService: number,
  age: number
): RetirementOption1 {
  const eligible = age >= 55 && yearsInDistrict >= 10;
  const base = new Decimal(currentSalary);
  const rateMultiplier = new Decimal("1").plus(
    RETIREMENT_RATE.dividedBy(100)
  );

  let y1 = base.times(rateMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  let y2 = y1.times(rateMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  let y3 = y2.times(rateMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  let y4 = y3.times(rateMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const trsCapMultiplier = new Decimal("1").plus(
    TRS_6PCT_CAP.dividedBy(100)
  );
  const maxAllowed = base.times(trsCapMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const trsCapWarning = y1.gt(maxAllowed);

  const totalSalaryCost = y1.plus(y2).plus(y3).plus(y4).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    option: "option1_4year",
    eligible,
    currentSalary,
    year1Salary: y1.toString(),
    year2Salary: y2.toString(),
    year3Salary: y3.toString(),
    year4Salary: y4.toString(),
    totalSalaryCost: totalSalaryCost.toString(),
    trsCapWarning,
  };
}

export function calcRetirementOption2(
  currentSalary: string,
  yearsInDistrict: number,
  yearsTotalService: number,
  age: number
): RetirementOption2 {
  const eligible = age >= 55 && yearsInDistrict >= 10;
  const base = new Decimal(currentSalary);
  const rateMultiplier = new Decimal("1").plus(
    RETIREMENT_RATE.dividedBy(100)
  );

  const y1 = base.times(rateMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const y2 = y1.times(rateMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const trsCapMultiplier = new Decimal("1").plus(TRS_6PCT_CAP.dividedBy(100));
  const maxAllowed = base.times(trsCapMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const trsCapWarning = y1.gt(maxAllowed);

  const serviceBonus = OPT2_SERVICE_BONUS.times(yearsInDistrict).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const trsBonus = OPT2_TRS_BONUS.times(yearsTotalService).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const insuranceBonus = OPT2_INSURANCE_BONUS.times(OPT2_INSURANCE_YEARS).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const postRetirementTotal = serviceBonus.plus(trsBonus).plus(insuranceBonus);

  const totalCostToDistrict = y1.plus(y2).plus(postRetirementTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    option: "option2_2year",
    eligible,
    currentSalary,
    year1Salary: y1.toString(),
    year2Salary: y2.toString(),
    postRetirementServiceBonus: serviceBonus.toString(),
    postRetirementTrsBonus: trsBonus.toString(),
    postRetirementInsuranceBonus: insuranceBonus.toString(),
    postRetirementTotal: postRetirementTotal.toString(),
    totalCostToDistrict: totalCostToDistrict.toString(),
    trsCapWarning,
  };
}

export function calcRetirementOption3(
  currentSalary: string,
  yearsInDistrict: number,
  age: number
): RetirementOption3 {
  const eligible = yearsInDistrict >= 10;
  const cappedYears = Math.min(yearsInDistrict, LONGEVITY_MAX_YEARS);
  const longevityBonus = LONGEVITY_RATE.times(cappedYears).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const base = new Decimal(currentSalary);
  const salaryWithBonus = base.plus(longevityBonus).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const trsCapMultiplier = new Decimal("1").plus(TRS_6PCT_CAP.dividedBy(100));
  const maxAllowed = base.times(trsCapMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const trsCapWarning = salaryWithBonus.gt(maxAllowed);

  return {
    option: "option3_longevity",
    eligible,
    yearsInDistrict: cappedYears,
    longevityBonus: longevityBonus.toString(),
    salaryWithBonus: salaryWithBonus.toString(),
    trsCapWarning,
  };
}

export interface WaveAnalysis {
  employeeCount: number;
  retirementYear: number;
  incentiveCostByYear: string[];
  replacementSavingsByYear: string[];
  netFiscalImpactByYear: string[];
  totalIncentiveCost: string;
  totalReplacementSavings: string;
  netFiscalImpact: string;
  breakEvenYear: number | null;
}

export function calcRetirementWave(
  employees: Array<{
    currentSalary: string;
    retirementYear: number;
    retirementOption: string;
    yearsInDistrict: number;
    yearsTotalService: number;
  }>,
  contractYears: number,
  replacementSalary: string
): WaveAnalysis {
  const incentiveCostByYear = Array(contractYears).fill(new Decimal("0"));
  const replacementSavingsByYear = Array(contractYears).fill(new Decimal("0"));

  for (const emp of employees) {
    const base = new Decimal(emp.currentSalary);
    const rateMultiplier = new Decimal("1").plus(RETIREMENT_RATE.dividedBy(100));

    for (let y = 0; y < contractYears; y++) {
      const yearAbsolute = y;
      if (yearAbsolute < emp.retirementYear) {
        const yearsOfIncentive = emp.retirementYear - yearAbsolute;
        const incentiveSalary = base.times(rateMultiplier.pow(yearsOfIncentive));
        const normalSalary = base.times(new Decimal("1.04").pow(yearsOfIncentive));
        const incentiveCost = incentiveSalary.minus(normalSalary);
        if (incentiveCost.gt(0)) {
          incentiveCostByYear[y] = incentiveCostByYear[y].plus(incentiveCost);
        }
      } else {
        const savings = base.minus(new Decimal(replacementSalary));
        if (savings.gt(0)) {
          replacementSavingsByYear[y] = replacementSavingsByYear[y].plus(savings);
        }
      }
    }
  }

  const netByYear = incentiveCostByYear.map((cost: Decimal, i: number) =>
    replacementSavingsByYear[i].minus(cost)
  );

  let cumulativeNet = new Decimal("0");
  let breakEvenYear: number | null = null;
  for (let i = 0; i < contractYears; i++) {
    cumulativeNet = cumulativeNet.plus(netByYear[i]);
    if (breakEvenYear === null && cumulativeNet.gt(0)) {
      breakEvenYear = i + 1;
    }
  }

  const totalIncentiveCost = incentiveCostByYear
    .reduce((a: Decimal, b: Decimal) => a.plus(b), new Decimal("0"))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalReplacementSavings = replacementSavingsByYear
    .reduce((a: Decimal, b: Decimal) => a.plus(b), new Decimal("0"))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const netFiscalImpact = totalReplacementSavings
    .minus(totalIncentiveCost)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    employeeCount: employees.length,
    retirementYear: employees[0]?.retirementYear ?? 0,
    incentiveCostByYear: incentiveCostByYear.map((d: Decimal) =>
      d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
    ),
    replacementSavingsByYear: replacementSavingsByYear.map((d: Decimal) =>
      d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
    ),
    netFiscalImpactByYear: netByYear.map((d: Decimal) =>
      d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
    ),
    totalIncentiveCost: totalIncentiveCost.toString(),
    totalReplacementSavings: totalReplacementSavings.toString(),
    netFiscalImpact: netFiscalImpact.toString(),
    breakEvenYear,
  };
}
