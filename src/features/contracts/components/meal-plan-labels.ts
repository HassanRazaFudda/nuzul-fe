import type { MealPlanKind } from '../api/contract.schemas';

export const MEAL_PLAN_LABELS: Record<MealPlanKind, string> = {
  perNightPerPerson: 'Per night per person',
  halfboard: 'Halfboard',
  fullboard: 'Fullboard',
};
