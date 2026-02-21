import {
  calculateETFDerived,
  calculateBuyAmount,
  calculateSellProceeds,
  isDividendMonth,
  getSingleDividendRate,
  simulateMonthGrowth,
  simulateGrowth,
  applyConfidence,
} from './etfModel';
import { ETFProduct } from './types';

const sampleETF: ETFProduct = {
  id: '0050',
  name: '元大台灣 50',
  yearsEstablished: 22,
  annualCAGR: 0.08,
  annualLAIR: 0.04,
  dividendMonths: [1, 7],
};

const quarterlyETF: ETFProduct = {
  id: '0056',
  name: '元大高股息',
  yearsEstablished: 18,
  annualCAGR: 0.06,
  annualLAIR: 0.05,
  dividendMonths: [1, 4, 7, 10],
};

const annualETF: ETFProduct = {
  id: '0051',
  name: '元大中型 100',
  yearsEstablished: 19,
  annualCAGR: 0.07,
  annualLAIR: 0.03,
  dividendMonths: [11],
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
  it('identifies custom dividend months [1, 7]', () => {
    expect(isDividendMonth(1, [1, 7])).toBe(true);
    expect(isDividendMonth(7, [1, 7])).toBe(true);
    expect(isDividendMonth(2, [1, 7])).toBe(false);
    expect(isDividendMonth(6, [1, 7])).toBe(false);
  });

  it('identifies quarterly dividend months [1, 4, 7, 10]', () => {
    expect(isDividendMonth(1, [1, 4, 7, 10])).toBe(true);
    expect(isDividendMonth(4, [1, 4, 7, 10])).toBe(true);
    expect(isDividendMonth(7, [1, 4, 7, 10])).toBe(true);
    expect(isDividendMonth(10, [1, 4, 7, 10])).toBe(true);
    expect(isDividendMonth(2, [1, 4, 7, 10])).toBe(false);
    expect(isDividendMonth(3, [1, 4, 7, 10])).toBe(false);
  });

  it('identifies annual dividend month [11]', () => {
    expect(isDividendMonth(11, [11])).toBe(true);
    expect(isDividendMonth(1, [11])).toBe(false);
    expect(isDividendMonth(12, [11])).toBe(false);
  });
});

describe('getSingleDividendRate', () => {
  it('returns LAIR/2 for 2 dividend months', () => {
    expect(getSingleDividendRate(sampleETF)).toBe(0.02); // 0.04 / 2
  });

  it('returns LAIR/4 for 4 dividend months', () => {
    expect(getSingleDividendRate(quarterlyETF)).toBe(0.0125); // 0.05 / 4
  });

  it('returns full LAIR for 1 dividend month', () => {
    expect(getSingleDividendRate(annualETF)).toBe(0.03); // 0.03 / 1
  });
});

describe('simulateMonthGrowth', () => {
  it('grows principal by MCAGR in non-dividend month', () => {
    const { newPrincipal, dividend } = simulateMonthGrowth(1000000, sampleETF, 2);
    const mcagr = Math.pow(1.08, 1 / 12) - 1;
    expect(dividend).toBe(0);
    expect(newPrincipal).toBeCloseTo(1000000 * (1 + mcagr), 0);
  });

  it('adds dividend in dividend month (Jan for [1,7])', () => {
    const { newPrincipal, dividend } = simulateMonthGrowth(1000000, sampleETF, 1);
    const mcagr = Math.pow(1.08, 1 / 12) - 1;
    const expectedDividend = 1000000 * 0.02; // LAIR/2
    expect(dividend).toBe(expectedDividend);
    expect(newPrincipal).toBeCloseTo(1000000 * (1 + mcagr) + expectedDividend, 0);
  });

  it('adds dividend in quarterly dividend month (Jan for [1,4,7,10])', () => {
    const { newPrincipal, dividend } = simulateMonthGrowth(1000000, quarterlyETF, 1);
    const mcagr = Math.pow(1.06, 1 / 12) - 1;
    const expectedDividend = 1000000 * 0.0125; // LAIR/4
    expect(dividend).toBe(expectedDividend);
    expect(newPrincipal).toBeCloseTo(1000000 * (1 + mcagr) + expectedDividend, 0);
  });
});

describe('simulateGrowth', () => {
  it('grows over multiple months', () => {
    const result = simulateGrowth(1000000, sampleETF, 2025, 1, 12);
    expect(result).toBeGreaterThan(1000000);
    expect(result).toBeGreaterThan(1100000);
  });

  it('handles 0 months', () => {
    const result = simulateGrowth(1000000, sampleETF, 2025, 1, 0);
    expect(result).toBe(1000000);
  });
});

describe('applyConfidence', () => {
  it('high confidence keeps original values', () => {
    const adjusted = applyConfidence(sampleETF, 'high');
    expect(adjusted.annualCAGR).toBe(0.08);
    expect(adjusted.annualLAIR).toBe(0.04);
  });

  it('mid confidence applies 80%', () => {
    const adjusted = applyConfidence(sampleETF, 'mid');
    expect(adjusted.annualCAGR).toBeCloseTo(0.064, 6);
    expect(adjusted.annualLAIR).toBeCloseTo(0.032, 6);
  });

  it('low confidence applies 60%', () => {
    const adjusted = applyConfidence(sampleETF, 'low');
    expect(adjusted.annualCAGR).toBeCloseTo(0.048, 6);
    expect(adjusted.annualLAIR).toBeCloseTo(0.024, 6);
  });
});
