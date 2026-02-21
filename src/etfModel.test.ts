import {
  calculateETFDerived,
  calculateBuyAmount,
  calculateSellProceeds,
  isDividendMonth,
  getSingleDividendRate,
  simulateMonthGrowth,
  simulateGrowth,
} from './etfModel';
import { ETFProduct } from './types';

const sampleETF: ETFProduct = {
  name: '0050',
  annualCAGR: 0.08,
  annualLAIR: 0.04,
  dividendFrequency: 'semi-annual',
};

const quarterlyETF: ETFProduct = {
  name: '0056',
  annualCAGR: 0.06,
  annualLAIR: 0.05,
  dividendFrequency: 'quarterly',
};

describe('calculateETFDerived', () => {
  it('calculates monthly CAGR correctly', () => {
    const derived = calculateETFDerived(sampleETF);
    // (1.08)^(1/12) - 1 ≈ 0.006434
    expect(derived.monthlyCAGR).toBeCloseTo(0.006434, 4);
  });

  it('has correct fee rates', () => {
    const derived = calculateETFDerived(sampleETF);
    expect(derived.buyFeeRate).toBe(0.001425);
    expect(derived.sellFeeRate).toBeCloseTo(0.002425, 6);
  });
});

describe('calculateBuyAmount', () => {
  it('deducts buy fee correctly', () => {
    const result = calculateBuyAmount(1000000);
    // 1000000 × (1 - 0.001425) = 998575
    expect(result).toBe(998575);
  });

  it('returns 0 for 0 investment', () => {
    expect(calculateBuyAmount(0)).toBe(0);
  });
});

describe('calculateSellProceeds', () => {
  it('deducts sell fee correctly', () => {
    const result = calculateSellProceeds(1000000);
    // 1000000 × (1 - 0.002425) = 997575
    expect(result).toBe(997575);
  });
});

describe('isDividendMonth', () => {
  it('identifies semi-annual dividend months (Feb, Aug)', () => {
    expect(isDividendMonth(2, 'semi-annual')).toBe(true);
    expect(isDividendMonth(8, 'semi-annual')).toBe(true);
    expect(isDividendMonth(1, 'semi-annual')).toBe(false);
    expect(isDividendMonth(6, 'semi-annual')).toBe(false);
  });

  it('identifies quarterly dividend months (Mar, Jun, Sep, Dec)', () => {
    expect(isDividendMonth(3, 'quarterly')).toBe(true);
    expect(isDividendMonth(6, 'quarterly')).toBe(true);
    expect(isDividendMonth(9, 'quarterly')).toBe(true);
    expect(isDividendMonth(12, 'quarterly')).toBe(true);
    expect(isDividendMonth(1, 'quarterly')).toBe(false);
    expect(isDividendMonth(2, 'quarterly')).toBe(false);
  });
});

describe('getSingleDividendRate', () => {
  it('returns LAIR/2 for semi-annual', () => {
    expect(getSingleDividendRate(sampleETF)).toBe(0.02); // 0.04 / 2
  });

  it('returns LAIR/4 for quarterly', () => {
    expect(getSingleDividendRate(quarterlyETF)).toBe(0.0125); // 0.05 / 4
  });
});

describe('simulateMonthGrowth', () => {
  it('grows principal by MCAGR in non-dividend month', () => {
    const { newPrincipal, dividend } = simulateMonthGrowth(1000000, sampleETF, 1);
    const mcagr = Math.pow(1.08, 1 / 12) - 1;
    expect(dividend).toBe(0);
    expect(newPrincipal).toBeCloseTo(1000000 * (1 + mcagr), 0);
  });

  it('adds dividend in semi-annual dividend month (Feb)', () => {
    const { newPrincipal, dividend } = simulateMonthGrowth(1000000, sampleETF, 2);
    const mcagr = Math.pow(1.08, 1 / 12) - 1;
    const expectedDividend = 1000000 * 0.02; // LAIR/2
    expect(dividend).toBe(expectedDividend);
    expect(newPrincipal).toBeCloseTo(1000000 * (1 + mcagr) + expectedDividend, 0);
  });

  it('adds dividend in quarterly dividend month (Mar)', () => {
    const { newPrincipal, dividend } = simulateMonthGrowth(1000000, quarterlyETF, 3);
    const mcagr = Math.pow(1.06, 1 / 12) - 1;
    const expectedDividend = 1000000 * 0.0125; // LAIR/4
    expect(dividend).toBe(expectedDividend);
    expect(newPrincipal).toBeCloseTo(1000000 * (1 + mcagr) + expectedDividend, 0);
  });
});

describe('simulateGrowth', () => {
  it('grows over multiple months', () => {
    const result = simulateGrowth(1000000, sampleETF, 2025, 1, 12);
    // After 12 months of CAGR growth + dividends (Feb and Aug)
    expect(result).toBeGreaterThan(1000000);
    // With 8% CAGR + 4% LAIR, should be roughly 12%+ growth
    expect(result).toBeGreaterThan(1100000);
  });

  it('handles 0 months', () => {
    const result = simulateGrowth(1000000, sampleETF, 2025, 1, 0);
    expect(result).toBe(1000000);
  });
});
