import {
  validateBasicSettings,
  calculateDerived,
  calcMonthsDiff,
  round2,
  addYearsToDate,
  annualToMonthlyRate,
} from './basicSettings';
import { BasicSettings } from './types';

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0)).toBe(0);
  });
});

describe('annualToMonthlyRate', () => {
  it('converts annual rate to monthly rate correctly', () => {
    // MCPI = (1+CPI)^(1/12) - 1
    const monthly = annualToMonthlyRate(0.02);
    // (1.02)^(1/12) - 1 ≈ 0.001652
    expect(monthly).toBeCloseTo(0.001652, 4);
  });

  it('returns 0 for 0% annual rate', () => {
    expect(annualToMonthlyRate(0)).toBe(0);
  });

  it('converts 10% annual rate correctly', () => {
    const monthly = annualToMonthlyRate(0.10);
    // (1.10)^(1/12) - 1 ≈ 0.007974
    expect(monthly).toBeCloseTo(0.007974, 4);
  });
});

describe('calcMonthsDiff', () => {
  it('calculates exact month difference', () => {
    const start = new Date(1990, 0, 1); // Jan 1, 1990
    const end = new Date(2025, 0, 1);   // Jan 1, 2025
    expect(calcMonthsDiff(start, end)).toBe(420);
  });

  it('calculates partial month difference', () => {
    const start = new Date(1990, 0, 15); // Jan 15, 1990
    const end = new Date(2025, 0, 1);    // Jan 1, 2025
    // 419 full months + partial month
    const result = calcMonthsDiff(start, end);
    expect(result).toBeLessThan(420);
    expect(result).toBeGreaterThan(419);
  });

  it('handles same-day-of-month correctly', () => {
    const start = new Date(2000, 5, 15); // Jun 15, 2000
    const end = new Date(2000, 8, 15);   // Sep 15, 2000
    expect(calcMonthsDiff(start, end)).toBe(3);
  });
});

describe('addYearsToDate', () => {
  it('adds years correctly', () => {
    const date = new Date(1990, 5, 15);
    const result = addYearsToDate(date, 60);
    expect(result.getFullYear()).toBe(2050);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });
});

describe('validateBasicSettings', () => {
  const validSettings: BasicSettings = {
    birthDate: new Date(1990, 0, 1),
    calculationDate: new Date(2025, 0, 1),
    retirementAge: 60,
    lifeExpectancy: 85,
    annualCPI: 0.02,
  };

  it('returns no errors for valid settings', () => {
    expect(validateBasicSettings(validSettings)).toHaveLength(0);
  });

  it('rejects retirement age out of range', () => {
    const errors = validateBasicSettings({ ...validSettings, retirementAge: 30 });
    expect(errors).toContain('退休年齡必須在 40 至 70 歲之間');
  });

  it('rejects life expectancy out of range', () => {
    const errors = validateBasicSettings({ ...validSettings, lifeExpectancy: 110 });
    expect(errors).toContain('預期壽命必須在 50 至 100 歲之間');
  });

  it('rejects CPI out of range', () => {
    const errors = validateBasicSettings({ ...validSettings, annualCPI: 0.15 });
    expect(errors).toContain('年 CPI 必須在 0% 至 10% 之間');
  });

  it('rejects birth date after calculation date', () => {
    const errors = validateBasicSettings({
      ...validSettings,
      birthDate: new Date(2030, 0, 1),
    });
    expect(errors).toContain('出生日期必須早於計算日期');
  });

  it('rejects life expectancy <= retirement age', () => {
    const errors = validateBasicSettings({
      ...validSettings,
      retirementAge: 65,
      lifeExpectancy: 60,
    });
    expect(errors).toContain('預期壽命必須大於退休年齡');
  });
});

describe('calculateDerived', () => {
  const settings: BasicSettings = {
    birthDate: new Date(1990, 0, 1),     // Jan 1, 1990
    calculationDate: new Date(2025, 5, 1), // Jun 1, 2025
    retirementAge: 60,
    lifeExpectancy: 85,
    annualCPI: 0.02,
  };

  it('calculates age correctly', () => {
    const derived = calculateDerived(settings);
    expect(derived.ageYears).toBe(35);
    expect(derived.ageMonths).toBe(5);
    expect(derived.ageDescription).toBe('35年 5月');
  });

  it('calculates investment period (IP) in months', () => {
    const derived = calculateDerived(settings);
    // From Jun 2025 to Jan 2050 = 294 months + partial
    expect(derived.investmentPeriodMonths).toBeGreaterThan(290);
    expect(derived.investmentPeriodMonths).toBeLessThan(300);
  });

  it('calculates distribution period (DP) in months', () => {
    const derived = calculateDerived(settings);
    // From retirement (60) to life expectancy (85) = 25 years = 300 months
    expect(derived.distributionPeriodMonths).toBe(300);
  });

  it('calculates monthly CPI correctly', () => {
    const derived = calculateDerived(settings);
    expect(derived.monthlyCPI).toBeCloseTo(0.001652, 4);
  });

  it('calculates retirement date correctly', () => {
    const derived = calculateDerived(settings);
    expect(derived.retirementDate.getFullYear()).toBe(2050);
    expect(derived.retirementDate.getMonth()).toBe(0); // January
  });

  it('calculates life end date correctly', () => {
    const derived = calculateDerived(settings);
    expect(derived.lifeEndDate.getFullYear()).toBe(2075);
  });

  it('throws error for invalid settings', () => {
    expect(() =>
      calculateDerived({ ...settings, retirementAge: 30 }),
    ).toThrow('設定驗證失敗');
  });
});
