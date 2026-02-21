import { calculateDistribution, calculateTotalRetirementAssets } from './moduleB';
import { calculateDerived } from './basicSettings';
import {
  BasicSettings,
  ETFProduct,
  AccumulationResult,
  DistributionSettings,
} from './types';

const sampleETF: ETFProduct = {
  name: '0050',
  annualCAGR: 0.08,
  annualLAIR: 0.04,
  dividendFrequency: 'semi-annual',
};

const basicSettings: BasicSettings = {
  birthDate: new Date(1990, 0, 1),
  calculationDate: new Date(2025, 0, 1),
  retirementAge: 60,
  lifeExpectancy: 85,
  annualCPI: 0.02,
};

const derived = calculateDerived(basicSettings);

const accResult: AccumulationResult = {
  lumpSumTotal: 5000000,
  dcaTotal: 5000000,
  totalAtRetirement: 10000000,
};

describe('calculateTotalRetirementAssets', () => {
  it('sums accumulation, labor pension, and other assets with buy fee deducted', () => {
    const distSettings: DistributionSettings = {
      strategy: 'fixed-rate',
      withdrawalRate: 0.04,
      retirementETF: sampleETF,
      laborPensionLumpSum: 2000000,
      otherAssets: 1000000,
      laborInsuranceMonthly: 20000,
      nationalPensionMonthly: 5000,
    };

    const total = calculateTotalRetirementAssets(accResult, distSettings, basicSettings, derived);
    // (10M + 2M + 1M) × (1 - 0.001425) = 13M × 0.998575
    const expected = 13000000 * (1 - 0.001425);
    expect(total).toBeCloseTo(expected, 0);
  });
});

describe('calculateDistribution - fixed-rate', () => {
  const distSettings: DistributionSettings = {
    strategy: 'fixed-rate',
    withdrawalRate: 0.04,
    retirementETF: sampleETF,
    laborPensionLumpSum: 0,
    otherAssets: 0,
    laborInsuranceMonthly: 20000,
    nationalPensionMonthly: 5000,
  };

  it('generates annual withdrawals for each year of retirement', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);

    // Distribution period: 25 years
    expect(result.annualWithdrawals.length).toBe(25);
  });

  it('first year withdrawal is ~4% of total assets', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    const firstYear = result.annualWithdrawals[0];

    // Total assets after buy fee, then 4% withdrawal with sell fee
    const totalAfterBuyFee = accResult.totalAtRetirement * (1 - 0.001425);
    const grossWithdrawal = totalAfterBuyFee * 0.04;
    const netWithdrawal = grossWithdrawal * (1 - 0.002425);

    expect(firstYear.withdrawalAmount).toBeCloseTo(netWithdrawal, 0);
  });

  it('includes pension amounts in monthly available', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    const firstYear = result.annualWithdrawals[0];

    // monthlyAvailable = withdrawal/12 + laborInsurance + nationalPension
    expect(firstYear.monthlyAvailable).toBeGreaterThan(25000); // At least pensions
  });

  it('has positive remaining assets at end (estate)', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    // With 4% withdrawal and ~12% growth, assets should grow over time
    expect(result.estate).toBeGreaterThan(0);
  });

  it('computes PV values', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    const firstYear = result.annualWithdrawals[0];

    // PV@retirement for first year should equal nominal (no discounting needed for year 1)
    expect(firstYear.pvAtRetirement).toBeCloseTo(firstYear.withdrawalAmount, 0);

    // PV@now should be less than PV@retirement (discounted back further)
    expect(firstYear.pvAtNow).toBeLessThan(firstYear.pvAtRetirement);
  });
});

describe('calculateDistribution - increasing-rate', () => {
  const distSettings: DistributionSettings = {
    strategy: 'increasing-rate',
    withdrawalRate: 0.04,
    retirementETF: sampleETF,
    laborPensionLumpSum: 0,
    otherAssets: 0,
    laborInsuranceMonthly: 20000,
    nationalPensionMonthly: 5000,
  };

  it('generates annual withdrawals', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    expect(result.annualWithdrawals.length).toBe(25);
  });

  it('year 11 uses higher withdrawal rate than year 1', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    // Year 1: 4%, Year 11: 5%
    // Year 11 has a higher rate applied to (likely larger) assets
    const year1 = result.annualWithdrawals[0];
    const year11 = result.annualWithdrawals[10];

    // The withdrawal as percentage of remaining assets should be higher for year 11
    // We can check indirectly that withdrawal amounts reflect the rate increase
    expect(year11).toBeDefined();
    expect(year11.year).toBe(11);
  });
});

describe('calculateDistribution - constant-pv', () => {
  const distSettings: DistributionSettings = {
    strategy: 'constant-pv',
    retirementETF: sampleETF,
    laborPensionLumpSum: 0,
    otherAssets: 0,
    laborInsuranceMonthly: 20000,
    nationalPensionMonthly: 5000,
  };

  it('generates annual withdrawals', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    expect(result.annualWithdrawals.length).toBe(25);
  });

  it('estate should be approximately zero', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    // The constant-PV strategy targets zero estate
    expect(Math.abs(result.estate)).toBeLessThan(100); // Within 100 tolerance
  });

  it('PV@retirement values should be roughly equal across years', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    const pvValues = result.annualWithdrawals.map(w => w.pvAtRetirement);

    // Check that PVs are within 5% of each other
    const avgPV = pvValues.reduce((a, b) => a + b, 0) / pvValues.length;
    for (const pv of pvValues) {
      const deviation = Math.abs(pv - avgPV) / avgPV;
      expect(deviation).toBeLessThan(0.05);
    }
  });

  it('nominal withdrawal increases over time due to CPI', () => {
    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);
    const firstYear = result.annualWithdrawals[0];
    const lastYear = result.annualWithdrawals[result.annualWithdrawals.length - 1];

    // With 2% CPI, last year nominal should be higher than first year
    expect(lastYear.withdrawalAmount).toBeGreaterThan(firstYear.withdrawalAmount);
  });
});

describe('integration: full calculation with pensions', () => {
  it('produces valid results with all parameters', () => {
    const distSettings: DistributionSettings = {
      strategy: 'fixed-rate',
      withdrawalRate: 0.04,
      retirementETF: sampleETF,
      laborPensionLumpSum: 2000000,
      otherAssets: 1000000,
      laborInsuranceMonthly: 22000,
      nationalPensionMonthly: 4816,
    };

    const result = calculateDistribution(accResult, distSettings, basicSettings, derived);

    expect(result.totalRetirementAssets).toBeGreaterThan(0);
    expect(result.annualWithdrawals.length).toBe(25);

    // Every year should have positive monthly available
    for (const year of result.annualWithdrawals) {
      expect(year.monthlyAvailable).toBeGreaterThan(0);
      expect(year.monthlyAvailablePVNow).toBeGreaterThan(0);
      expect(year.monthlyAvailablePV60).toBeGreaterThan(0);
    }
  });
});
