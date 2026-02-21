import { simulateLumpSum, simulateDCA, calculateAccumulation } from './moduleA';
import { calculateDerived } from './basicSettings';
import { BasicSettings, ETFProduct, LumpSumInvestment, DCAInvestment, AccumulationSettings } from './types';

const sampleETF: ETFProduct = {
  name: '0050',
  annualCAGR: 0.08,
  annualLAIR: 0.04,
  dividendFrequency: 'semi-annual',
};

const basicSettings: BasicSettings = {
  birthDate: new Date(1990, 0, 1),        // Jan 1, 1990
  calculationDate: new Date(2025, 0, 1),   // Jan 1, 2025
  retirementAge: 60,
  lifeExpectancy: 85,
  annualCPI: 0.02,
};

const derived = calculateDerived(basicSettings);

describe('simulateLumpSum', () => {
  it('grows a lump sum investment over the investment period', () => {
    const investment: LumpSumInvestment = {
      amount: 1000000,
      etf: sampleETF,
    };

    const result = simulateLumpSum(investment, basicSettings, derived);

    // 1M invested for ~25 years at 8% CAGR + 4% dividends should grow significantly
    expect(result).toBeGreaterThan(1000000);
    // Rough check: 1M × (1.08)^25 ≈ 6.85M (CAGR only, before fees and dividends)
    expect(result).toBeGreaterThan(5000000);
  });

  it('deducts buy fee from initial amount', () => {
    const investment: LumpSumInvestment = {
      amount: 1000000,
      etf: { ...sampleETF, annualCAGR: 0, annualLAIR: 0 },
    };

    // With 0% growth and 0% dividends, result should be amount minus buy fee
    const result = simulateLumpSum(investment, basicSettings, derived);
    expect(result).toBeCloseTo(1000000 * (1 - 0.001425), 0);
  });
});

describe('simulateDCA', () => {
  it('accumulates monthly contributions over the investment period', () => {
    const investment: DCAInvestment = {
      monthlyAmount: 10000,
      etf: sampleETF,
    };

    const result = simulateDCA(investment, basicSettings, derived);

    // 10,000/month for ~300 months = 3M base, should grow with compounding
    expect(result).toBeGreaterThan(3000000);
  });

  it('with zero growth, total is sum of contributions minus fees', () => {
    const investment: DCAInvestment = {
      monthlyAmount: 10000,
      etf: { ...sampleETF, annualCAGR: 0, annualLAIR: 0 },
    };

    const totalMonths = Math.floor(derived.investmentPeriodMonths);
    const result = simulateDCA(investment, basicSettings, derived);

    // Each month: 10000 × (1 - 0.001425)
    const expectedPerMonth = 10000 * (1 - 0.001425);
    const expected = expectedPerMonth * totalMonths;
    expect(result).toBeCloseTo(expected, 0);
  });
});

describe('calculateAccumulation', () => {
  it('combines lump sum and DCA results', () => {
    const accSettings: AccumulationSettings = {
      lumpSumInvestments: [
        { amount: 1000000, etf: sampleETF },
      ],
      dcaInvestments: [
        { monthlyAmount: 10000, etf: sampleETF },
      ],
    };

    const result = calculateAccumulation(accSettings, basicSettings, derived);

    expect(result.lumpSumTotal).toBeGreaterThan(0);
    expect(result.dcaTotal).toBeGreaterThan(0);
    expect(result.totalAtRetirement).toBe(result.lumpSumTotal + result.dcaTotal);
  });

  it('handles multiple investments', () => {
    const accSettings: AccumulationSettings = {
      lumpSumInvestments: [
        { amount: 500000, etf: sampleETF },
        { amount: 500000, etf: sampleETF },
      ],
      dcaInvestments: [
        { monthlyAmount: 5000, etf: sampleETF },
        { monthlyAmount: 5000, etf: sampleETF },
      ],
    };

    const singleAccSettings: AccumulationSettings = {
      lumpSumInvestments: [{ amount: 1000000, etf: sampleETF }],
      dcaInvestments: [{ monthlyAmount: 10000, etf: sampleETF }],
    };

    const multiResult = calculateAccumulation(accSettings, basicSettings, derived);
    const singleResult = calculateAccumulation(singleAccSettings, basicSettings, derived);

    // Due to linearity, splitting into equal parts should give same total
    expect(multiResult.totalAtRetirement).toBeCloseTo(singleResult.totalAtRetirement, 0);
  });

  it('handles empty investments', () => {
    const accSettings: AccumulationSettings = {
      lumpSumInvestments: [],
      dcaInvestments: [],
    };

    const result = calculateAccumulation(accSettings, basicSettings, derived);
    expect(result.lumpSumTotal).toBe(0);
    expect(result.dcaTotal).toBe(0);
    expect(result.totalAtRetirement).toBe(0);
  });
});
