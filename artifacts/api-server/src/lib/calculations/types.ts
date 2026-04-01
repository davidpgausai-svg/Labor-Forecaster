export type IncreaseType =
  | "fixed_percentage"
  | "cpi_formula"
  | "flat_dollar"
  | "step_only"
  | "custom";

export interface YearConfig {
  contractYear: number;
  yearLabel: string;
  increaseType: IncreaseType;
  effectiveRate?: string | null;
  fixedPercentage?: string | null;
  cpiValue?: string | null;
  cpiAdder?: string | null;
  cpiCap?: string | null;
  cpiFloor?: string | null;
  highEarnerThreshold?: string | null;
  highEarnerFlatIncrease?: string | null;
  educationalAdvancementBa15?: string | null;
  educationalAdvancementMa?: string | null;
  educationalAdvancementMa15?: string | null;
  stepAdvancement: boolean;
  healthPremiumIncreaseRate?: string | null;
  healthEmployerCapRate?: string | null;
}

export interface EmployeeInput {
  id: string;
  compensationType: "salary" | "hourly";
  currentAnnualSalary: string;
  currentStep?: number | null;
  currentHourlyRate?: string | null;
  annualHours?: string | null;
  currentLaneId?: string | null;
  currentHourlyCategoryId?: string | null;
  insuranceElection:
    | "single"
    | "single_plus_spouse"
    | "single_plus_child"
    | "family"
    | "waived";
  retirementEligible: boolean;
  retirementPlan?: string | null;
  retirementTargetYear?: number | null;
  yearsInDistrict: number;
  yearsTotalService: number;
  contractYear: number;
  effectiveDate?: string | null;
  terminationDate?: string | null;
}

export interface BargainingUnitConfig {
  id: string;
  compensationType: "salary" | "hourly";
  retirementSystem: "TRS" | "IMRF" | "other";
  retirementEmployeeRate: string;
  retirementEmployerRate: string;
  retirementGrossUpRate: string;
  ficaRate: string;
  ficaExempt: boolean;
  healthInsuranceSingleAnnual: string;
  healthInsuranceFamilyAnnual: string;
  dentalAnnual: string;
  lifeInsuranceAnnual: string;
  disabilityInsuranceAnnual: string;
  hsaContributionSingle: string;
  hsaContributionFamily: string;
  workersCompRate: string;
  contractYears: number;
}

export interface ScheduleCell {
  laneId: string;
  stepNumber: number;
  salaryAmount: string;
}

export interface LaneInfo {
  id: string;
  name: string;
  indexMultiplier: string;
  displayOrder: number;
}

export interface StepInfo {
  id: string;
  stepNumber: number;
  incrementMultiplier: string;
}

export interface SalaryScheduleData {
  id: string;
  baseSalary: string;
  lanes: LaneInfo[];
  steps: StepInfo[];
  cells: ScheduleCell[];
}

export interface HourlyCategory {
  id: string;
  name: string;
  baseHourlyRate: string;
  annualHours: string;
}

export interface EmployeeYearResult {
  employeeId: string;
  scenarioId: string;
  contractYear: number;
  projectedStep: number | null;
  projectedLaneId: string | null;
  projectedHourlyRate: string | null;
  projectedBaseSalary: string;
  projectedTotalCompensation: string;
  retirementContribution: string;
  ficaCost: string;
  healthInsuranceCost: string;
  otherBenefitsCost: string;
  totalEmployerCost: string;
  effectiveRate: string | null;
  isRetirementYear: boolean;
  retirementIncentiveAmount: string | null;
}

export interface ScenarioYearSummary {
  contractYear: number;
  yearLabel: string;
  bargainingUnitId: string;
  totalPayroll: string;
  totalTRS: string;
  totalIMRF: string;
  totalFICA: string;
  totalHealthInsurance: string;
  totalOtherBenefits: string;
  totalBenefits: string;
  totalEmployerCost: string;
  employeeCount: number;
  avgSalary: string;
  effectiveRate: string | null;
}

export interface HeatmapCell {
  laneId: string;
  laneName: string;
  stepNumber: number;
  employeeCount: number;
  totalSalary: string;
  employees: Array<{ id: string; name: string; salary: string }>;
}
