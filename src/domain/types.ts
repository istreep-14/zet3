export const DENOMS = [100, 50, 20, 10, 5, 1] as const;

export type Denomination = (typeof DENOMS)[number];
export type BillCounts = Record<Denomination, number>;
export type CashMode = 'billCounts' | 'netTotal';
export type CloserOverride = 'auto' | 'closer' | 'notCloser';

export interface StaffMember {
  id: string;
  name: string;
  inTime: string;
  outTime: string;
  closerOverride: CloserOverride;
}

export interface CashState {
  mode: CashMode;
  billCounts: Record<Denomination, string>;
  netTotal: string;
  additions: TipAddition[];
}

export interface TipAddition {
  id: string;
  amount: string;
  note: string;
}

export interface SessionState {
  version: 2;
  date: string;
  closeTime: string;
  staff: StaffMember[];
  cash: CashState;
}

export interface ComputedPerson {
  id: string;
  name: string;
  inValue: number;
  outValue: number;
  outWasPlaceholder: boolean;
  hours: number;
  effectiveOut: number;
  isCloser: boolean;
  exact: number;
  base: number;
  bonus: number;
  final: number;
  bills: BillCounts;
}

export interface SmallBillRequirements {
  minOnes: number;
  availableOnes: number;
  onesShort: number;
  minOneFiveValue: number;
  availableOneFiveValue: number;
  oneFiveShort: number;
  minOneFiveTenValue: number;
  availableOneFiveTenValue: number;
  oneFiveTenShort: number;
  oddTenCount: number;
  fiftyEligibleOddTenCount: number;
  fiftyCoverage: number;
  fiftyCoverageValue: number;
}

export interface DistributionSlot {
  id: string;
  name: string;
  target: number;
  isChump: boolean;
  bills: BillCounts;
}

export interface CalculationResult {
  status: 'needsInfo' | 'estimate' | 'blocked' | 'ready';
  warnings: string[];
  errors: string[];
  total: number;
  billTotal: number;
  additionsTotal: number;
  totalHours: number;
  rate: number;
  rawRemainder: number;
  perCloserBonus: number;
  chump: number;
  staff: ComputedPerson[];
  pool: BillCounts;
  requirements: SmallBillRequirements | null;
  distribution: {
    ok: boolean;
    error: string;
    slots: DistributionSlot[];
  };
}
