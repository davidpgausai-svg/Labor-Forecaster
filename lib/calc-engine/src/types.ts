export type IncreaseType =
  | "fixed_percentage"
  | "cpi_formula"
  | "flat_dollar"
  | "step_only"
  | "custom";

export type CompensationScheduleType =
  | "index_based_grid"
  | "individual_salary"
  | "direct_import_grid"
  | "hourly"
  | "per_diem"
  | "flat_rate"
  | "stipend_table"
  | "range_based";

export type BaseAdjustmentType = "percentage" | "dollar" | "set_directly";

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
  cpiIndexName?: string | null;
  highEarnerThreshold?: string | null;
  highEarnerFlatIncrease?: string | null;
  educationalAdvancementBa15?: string | null;
  educationalAdvancementMa?: string | null;
  educationalAdvancementMa15?: string | null;
  stepAdvancement: boolean;
  healthPremiumIncreaseRate?: string | null;
  healthEmployerCapRate?: string | null;
  // Unified trend rate — takes precedence over healthPremiumIncreaseRate when set
  benefitCostTrendRate?: string | null;
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
  pendingEffectiveContractYear?: number | null;
  pendingBargainingUnitId?: string | null;
  pendingEmployeeGroupId?: string | null;
  pendingCurrentStep?: number | null;
  pendingCurrentLaneId?: string | null;
  pendingAnnualSalary?: string | null;
}

export interface IndexGridIndex {
  laneId: string;
  stepNumber: number;
  indexValue: string;
  isCapped: boolean;
}

export interface IndexGridConfig {
  baseAnchorSalary: string;
  maxSteps: number;
  indices: IndexGridIndex[];
}

export interface YearConfigWithSchedule extends YearConfig {
  employeeGroupId?: string | null;
  compensationScheduleId?: string | null;
  scheduleType?: CompensationScheduleType | null;
  baseAdjustmentType?: BaseAdjustmentType | null;
  baseAdjustmentValue?: string | null;
}

export interface EmployeeGroupConfig {
  id: string;
  name: string;
  code: string;
  contractYears: number;
  contractDays?: number | null;
  retirementSystem: string;
  retirementEmployeeRate: string;
  retirementEmployerRate: string;
  retirementGrossUpRate: string;
  ficaRate: string;
  ficaExempt: boolean;
  healthInsuranceSingleAnnual: string;
  healthInsuranceFamilyAnnual: string;
  healthInsuranceEmployerCapRate?: string | null;
  dentalAnnual: string;
  lifeInsuranceAnnual: string;
  disabilityInsuranceAnnual: string;
  hsaContributionSingle: string;
  hsaContributionFamily: string;
  workersCompRate: string;
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

// ─── Normalized Employer Cost Config (from Employer Cost Center tables) ────────

export interface BenefitTierData {
  tier: string; // ee_only | ee_spouse | ee_child | family
  employerContributionAnnual: string;
}

export interface BenefitPlanData {
  id: string;
  category: string; // health | dental | vision | life | add | ltd | std | other
  planName: string;
  calculationMethod: string; // flat_dollar | rate_per_100 | rate_per_1000 | percent_of_salary
  tiers: BenefitTierData[]; // populated for flat_dollar plans
  salaryRate?: string | null; // rate for rate-based plans (from benefit_plan_rates)
  coveredEarningsCap?: string | null;
}

export interface RetirementPlanData {
  id: string;
  planName: string;
  planType: string; // defined_benefit | defined_contribution
  employerRate: string;
  grossUpRate: string;
  employeeRate: string;
  isFicaExempt: boolean;
}

export interface EmployerTaxData {
  ssRate: string;
  ssWageBase: string;
  medicareRate: string;
  futaRate: string;
  futaWageBase: string;
  sutaRate: string;
  sutaWageBase: string;
  workersCompRatePer100: string;
}

export interface HsaContributionData {
  tier: string;
  annualContribution: string;
}

/** Loaded from Employer Cost Center normalized tables. All fields optional/nullable —
 *  if not present, calcBenefits falls back to BargainingUnitConfig flat fields. */
export interface EmployerCostConfig {
  taxConfig: EmployerTaxData | null;
  benefitPlans: BenefitPlanData[];
  retirementPlan: RetirementPlanData | null;
  hsaContributions: HsaContributionData[];
  flatCosts: Array<{ costName: string; annualCostPerEmployee: string }>;
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
  futaCost?: string;
  sutaCost?: string;
  healthInsuranceCost: string;
  otherBenefitsCost: string;
  totalEmployerCost: string;
  effectiveRate: string | null;
  isRetirementYear: boolean;
  retirementIncentiveAmount: string | null;
  projectedDailyRate: string | null;
  rangePosition: string | null;
  stipendTotalAmount: string | null;
  stipendBreakdown: Array<{ stipendId: string; stipendName: string; amount: string }> | null;
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

export interface PositionYearResult {
  positionId: string;
  employeeId: string;
  scenarioId: string;
  contractYear: number;
  fteFraction: string;
  projectedBaseSalaryCents: number;
  projectedStep: number | null;
  projectedLaneId: string | null;
  projectedHourlyRate: string | null;
  retirementContributionCents: number;
  ficaCostCents: number;
  workersCompCents: number;
  effectiveRate: string | null;
}

export interface ScenarioCalculationResult {
  scenarioId: string;
  scenarioName: string;
  status: string;
  yearSummaries: Array<ScenarioYearSummary & { bargainingUnitName: string | null }>;
  districtWideSummary: Array<{
    contractYear: number;
    yearLabel: string;
    totalPayroll: string;
    totalBenefits: string;
    totalEmployerCost: string;
    employeeCount: number;
  }>;
  totalFiveYearCost: string;
  employeeCount: number;
}
