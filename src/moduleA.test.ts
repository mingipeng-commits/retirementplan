import { simulateLumpSum, simulateDCA, simulateLumpSumDetailed, simulateDCADetailed, calculateAccumulation } from './moduleA';
import { calculateDerived } from './basicSettings';
import { BasicSettings, ETFProduct, LumpSumInvestment, DCAInvestment, AccumulationSettings } from './types';

const sampleETF: ETFProduct = {
  id: '0050',
  name: '元大台灣 50',
  yearsEstablished: 22,
  annualCAGR: 0.08,
  annualLAIR: 0.04,
  dividendMonths: [1, 7],
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
      confidence: 'high',
    };

    const result = simulateLumpSum(investment, basicSettings, derived);
    expect(result).toBeGreaterThan(1000000);
    expect(result).toBeGreaterThan(5000000);
  });

  it('deducts buy fee from initial amount', () => {
    const investment: LumpSumInvestment = {
      amount: 1000000,
      etf: { ...sampleETF, annualCAGR: 0, annualLAIR: 0 },
      confidence: 'high',
    };

    const result = simulateLumpSum(investment, basicSettings, derived);
    expect(result).toBeCloseTo(1000000 * (1 - 0.001425), 0);
  });

  it('mid confidence reduces growth', () => {
    const highInv: LumpSumInvestment = { amount: 1000000, etf: sampleETF, confidence: 'high' };
    const midInv: LumpSumInvestment = { amount: 1000000, etf: sampleETF, confidence: 'mid' };

    const highResult = simulateLumpSum(highInv, basicSettings, derived);
    const midResult = simulateLumpSum(midInv, basicSettings, derived);
    expect(midResult).toBeLessThan(highResult);
    expect(midResult).toBeGreaterThan(1000000);
  });
});

describe('simulateLumpSumDetailed', () => {
  it('returns monthly details', () => {
    const investment: LumpSumInvestment = {
      amount: 1000000,
      etf: sampleETF,
      confidence: 'high',
    };

    const result = simulateLumpSumDetailed(investment, basicSettings, derived);
    const totalMonths = Math.floor(derived.investmentPeriodMonths);

    expect(result.monthlyDetails.length).toBe(totalMonths);
    expect(result.monthlyDetails[0].month).toBe(1);
    expect(result.monthlyDetails[0].purchase).toBe(0); // lump sum: no monthly purchase
    expect(result.monthlyDetails[0].beginBalance).toBeGreaterThan(0);
    expect(result.finalValue).toBeCloseTo(result.monthlyDetails[totalMonths - 1].endBalance, 0);
  });
});

describe('simulateDCA', () => {
  it('accumulates monthly contributions over the investment period', () => {
    const investment: DCAInvestment = {
      monthlyAmount: 10000,
      etf: sampleETF,
      confidence: 'high',
    };

    const result = simulateDCA(investment, basicSettings, derived);
    expect(result).toBeGreaterThan(3000000);
  });

  it('with zero growth, total is sum of contributions minus fees', () => {
    const investment: DCAInvestment = {
      monthlyAmount: 10000,
      etf: { ...sampleETF, annualCAGR: 0, annualLAIR: 0 },
      confidence: 'high',
    };

    const totalMonths = Math.floor(derived.investmentPeriodMonths);
    const result = simulateDCA(investment, basicSettings, derived);

    const expectedPerMonth = 10000 * (1 - 0.001425);
    const expected = expectedPerMonth * totalMonths;
    expect(result).toBeCloseTo(expected, 0);
  });
});

describe('simulateDCADetailed', () => {
  it('returns monthly details with purchases', () => {
    const investment: DCAInvestment = {
      monthlyAmount: 10000,
      etf: sampleETF,
      confidence: 'high',
    };

    const result = simulateDCADetailed(investment, basicSettings, derived);
    expect(result.monthlyDetails.length).toBeGreaterThan(0);
    expect(result.monthlyDetails[0].purchase).toBeGreaterThan(0); // DCA has monthly purchases
  });
});

describe('calculateAccumulation', () => {
  it('combines lump sum and DCA results', () => {
    const accSettings: AccumulationSettings = {
      lumpSumInvestments: [
        { amount: 1000000, etf: sampleETF, confidence: 'high' },
      ],
      dcaInvestments: [
        { monthlyAmount: 10000, etf: sampleETF, confidence: 'high' },
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
        { amount: 500000, etf: sampleETF, confidence: 'high' },
        { amount: 500000, etf: sampleETF, confidence: 'high' },
      ],
      dcaInvestments: [
        { monthlyAmount: 5000, etf: sampleETF, confidence: 'high' },
        { monthlyAmount: 5000, etf: sampleETF, confidence: 'high' },
      ],
    };

    const singleAccSettings: AccumulationSettings = {
      lumpSumInvestments: [{ amount: 1000000, etf: sampleETF, confidence: 'high' }],
      dcaInvestments: [{ monthlyAmount: 10000, etf: sampleETF, confidence: 'high' }],
    };

    const multiResult = calculateAccumulation(accSettings, basicSettings, derived);
    const singleResult = calculateAccumulation(singleAccSettings, basicSettings, derived);

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
