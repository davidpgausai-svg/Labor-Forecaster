import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export interface StipendDefinition {
  id: string;
  name: string;
  category: string;
  amountType: "fixed_dollar" | "percentage_of_base" | "hourly" | "per_event";
  amountCents: number;
  percentageValue: string | null;
  maxAmountCents: number | null;
  increaseWithBase: boolean;
  trsCreditable: boolean;
  imrfCreditable: boolean;
}

export interface EmployeeStipendAssignment {
  stipendDefinitionId: string;
  overrideAmountCents: number | null;
  hoursOrEvents: number | null;
}

export interface StipendResult {
  totalStipendAmount: Decimal;
  trsCreditable: Decimal;
  imrfCreditable: Decimal;
  breakdown: Array<{
    stipendId: string;
    stipendName: string;
    amount: Decimal;
    isTrsCreditable: boolean;
    isImrfCreditable: boolean;
  }>;
}

export function calcEmployeeStipends(
  assignments: EmployeeStipendAssignment[],
  definitions: StipendDefinition[],
  baseSalaryForYear: Decimal,
  yearIdx: number,
  baseIncreaseRate: Decimal | null
): StipendResult {
  let totalStipendAmount = new Decimal("0");
  let trsCreditable = new Decimal("0");
  let imrfCreditable = new Decimal("0");
  const breakdown: StipendResult["breakdown"] = [];

  for (const assignment of assignments) {
    const def = definitions.find((d) => d.id === assignment.stipendDefinitionId);
    if (!def) continue;

    // If the employee has an override, it takes precedence over all calculations
    if (assignment.overrideAmountCents != null) {
      const amount = new Decimal(assignment.overrideAmountCents)
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalStipendAmount = totalStipendAmount.plus(amount);
      if (def.trsCreditable) trsCreditable = trsCreditable.plus(amount);
      if (def.imrfCreditable) imrfCreditable = imrfCreditable.plus(amount);
      breakdown.push({
        stipendId: def.id,
        stipendName: def.name,
        amount,
        isTrsCreditable: def.trsCreditable,
        isImrfCreditable: def.imrfCreditable,
      });
      continue;
    }

    let amount: Decimal;

    switch (def.amountType) {
      case "fixed_dollar":
        amount = new Decimal(def.amountCents).dividedBy(100);
        // Compound with base if configured (approximation: uses current year rate ^ yearIdx)
        if (def.increaseWithBase && yearIdx > 0 && baseIncreaseRate !== null) {
          const multiplier = new Decimal("1")
            .plus(baseIncreaseRate.dividedBy(100))
            .pow(yearIdx);
          amount = amount.times(multiplier);
        }
        break;

      case "percentage_of_base":
        // Scales naturally with base salary — no separate compounding needed
        amount = baseSalaryForYear.times(
          new Decimal(def.percentageValue ?? "0").dividedBy(100)
        );
        break;

      case "hourly":
      case "per_event": {
        const count = assignment.hoursOrEvents != null
          ? new Decimal(assignment.hoursOrEvents)
          : new Decimal("0");
        amount = new Decimal(def.amountCents).dividedBy(100).times(count);
        if (def.increaseWithBase && yearIdx > 0 && baseIncreaseRate !== null) {
          const multiplier = new Decimal("1")
            .plus(baseIncreaseRate.dividedBy(100))
            .pow(yearIdx);
          amount = amount.times(multiplier);
        }
        break;
      }

      default:
        amount = new Decimal("0");
    }

    // Apply cap
    if (def.maxAmountCents != null) {
      const cap = new Decimal(def.maxAmountCents).dividedBy(100);
      if (amount.gt(cap)) amount = cap;
    }

    amount = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    totalStipendAmount = totalStipendAmount.plus(amount);
    if (def.trsCreditable) trsCreditable = trsCreditable.plus(amount);
    if (def.imrfCreditable) imrfCreditable = imrfCreditable.plus(amount);

    breakdown.push({
      stipendId: def.id,
      stipendName: def.name,
      amount,
      isTrsCreditable: def.trsCreditable,
      isImrfCreditable: def.imrfCreditable,
    });
  }

  return {
    totalStipendAmount: totalStipendAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    trsCreditable: trsCreditable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    imrfCreditable: imrfCreditable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    breakdown,
  };
}
