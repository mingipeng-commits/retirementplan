import {
  BasicSettings,
  DerivedCalculations,
  DistributionSettings,
  DistributionResult,
  AccumulationResult,
  AnnualWithdrawal,
  ETFProduct,
  WithdrawalStrategy,
} from './types';
import { annualToMonthlyRate, round2 } from './basicSettings';
import { simulateMonthGrowth, calculateBuyAmount, calculateSellProceeds } from './etfModel';

/**
 * Module B: 分配模組
 *
 * 計算退休後的資產分配與提領計畫
 */

/**
 * 計算退休當下的總資產
 *
 * 包含：
 * 1. Module A 的積累結果（一次性 + 定期定額）
 * 2. 新制勞退一次領出（固定在滿 60 歲時提領）
 * 3. 其他退休當下可歸戶的資產
 *
 * 所有資產全數滾入一個追蹤大盤指數的被動式 ETF 基金
 */
export function calculateTotalRetirementAssets(
  accResult: AccumulationResult,
  distSettings: DistributionSettings,
  basicSettings: BasicSettings,
  derived: DerivedCalculations,
): number {
  let total = accResult.totalAtRetirement;

  // 新制勞退：固定在滿 60 歲時提領出來
  // 如果退休年齡 >= 60，勞退金在退休當下已經可以加入
  // 如果退休年齡 < 60，勞退金需要等到 60 歲才能提領，
  // 但在此簡化模型中，我們在退休當下一併計入
  // （實際上 60 歲前退休的情況下，勞退金會在 60 歲時才加入 ETF）
  total += distSettings.laborPensionLumpSum;

  // 其他資產
  total += distSettings.otherAssets;

  // 全數滾入 ETF（扣除買入手續費）
  total = calculateBuyAmount(total);

  return total;
}

/**
 * 策略一：固定比率提領
 *
 * 退休後每年年初固定領出資產的 x% 當作當年的可運用退休金
 * 直到壽命結束，壽命結束當下未領出的資產為遺產
 */
function simulateFixedRate(
  totalAssets: number,
  withdrawalRate: number,
  etf: ETFProduct,
  retirementDate: Date,
  distributionYears: number,
  monthlyCPI: number,
  investmentPeriodMonths: number,
  laborInsuranceMonthly: number,
  nationalPensionMonthly: number,
): AnnualWithdrawal[] {
  const results: AnnualWithdrawal[] = [];
  let assets = totalAssets;
  let retirementMonth = retirementDate.getMonth() + 1;

  for (let year = 1; year <= distributionYears; year++) {
    // 年初提領
    const withdrawal = assets * withdrawalRate;
    // 提領時賣出 ETF 需扣除賣出費用
    const netWithdrawal = calculateSellProceeds(withdrawal);
    assets -= withdrawal;

    // 計算當年 ETF 增長（12個月）
    let currentMonth = retirementMonth;
    let yearStartAssets = assets;
    for (let m = 0; m < 12; m++) {
      const result = simulateMonthGrowth(assets, etf, currentMonth);
      assets = result.newPrincipal;
      currentMonth++;
      if (currentMonth > 12) currentMonth = 1;
    }
    const etfGrowth = assets - yearStartAssets;

    // 月可用金額
    const monthlyFromWithdrawal = netWithdrawal / 12;
    const monthlyAvailable = monthlyFromWithdrawal + laborInsuranceMonthly + nationalPensionMonthly;

    // PV 計算
    // 退休後第 year 年的月份起點（相對於退休日）
    const monthsFromRetirement = (year - 1) * 12;
    // 相對於今日的月份
    const monthsFromNow = investmentPeriodMonths + monthsFromRetirement;

    const pvAtRetirement = round2(netWithdrawal / Math.pow(1 + monthlyCPI, monthsFromRetirement));
    const pvAtNow = round2(netWithdrawal / Math.pow(1 + monthlyCPI, monthsFromNow));

    const monthlyPVNow = round2(monthlyAvailable / Math.pow(1 + monthlyCPI, monthsFromNow));
    const monthlyPV60 = round2(monthlyAvailable / Math.pow(1 + monthlyCPI, monthsFromRetirement));

    results.push({
      year,
      withdrawalAmount: round2(netWithdrawal),
      pvAtRetirement,
      pvAtNow,
      remainingAssets: round2(assets),
      etfGrowth: round2(etfGrowth),
      monthlyAvailable: round2(monthlyAvailable),
      monthlyAvailablePVNow: monthlyPVNow,
      monthlyAvailablePV60: monthlyPV60,
    });
  }

  return results;
}

/**
 * 策略二：遞增比率提領
 *
 * 退休後每年年初領出資產的 x%，x 每十年增加 1%
 * Year 1~10: x%, Year 11~20: (x+1)%, Year 21~30: (x+2)%, ...
 */
function simulateIncreasingRate(
  totalAssets: number,
  baseRate: number,
  etf: ETFProduct,
  retirementDate: Date,
  distributionYears: number,
  monthlyCPI: number,
  investmentPeriodMonths: number,
  laborInsuranceMonthly: number,
  nationalPensionMonthly: number,
): AnnualWithdrawal[] {
  const results: AnnualWithdrawal[] = [];
  let assets = totalAssets;
  let retirementMonth = retirementDate.getMonth() + 1;

  for (let year = 1; year <= distributionYears; year++) {
    // 每十年增加 1%
    const decadeIndex = Math.floor((year - 1) / 10);
    const currentRate = baseRate + decadeIndex * 0.01;

    // 年初提領
    const withdrawal = assets * currentRate;
    const netWithdrawal = calculateSellProceeds(withdrawal);
    assets -= withdrawal;

    // 當年 ETF 增長
    let currentMonth = retirementMonth;
    let yearStartAssets = assets;
    for (let m = 0; m < 12; m++) {
      const result = simulateMonthGrowth(assets, etf, currentMonth);
      assets = result.newPrincipal;
      currentMonth++;
      if (currentMonth > 12) currentMonth = 1;
    }
    const etfGrowth = assets - yearStartAssets;

    const monthlyFromWithdrawal = netWithdrawal / 12;
    const monthlyAvailable = monthlyFromWithdrawal + laborInsuranceMonthly + nationalPensionMonthly;

    const monthsFromRetirement = (year - 1) * 12;
    const monthsFromNow = investmentPeriodMonths + monthsFromRetirement;

    const pvAtRetirement = round2(netWithdrawal / Math.pow(1 + monthlyCPI, monthsFromRetirement));
    const pvAtNow = round2(netWithdrawal / Math.pow(1 + monthlyCPI, monthsFromNow));

    const monthlyPVNow = round2(monthlyAvailable / Math.pow(1 + monthlyCPI, monthsFromNow));
    const monthlyPV60 = round2(monthlyAvailable / Math.pow(1 + monthlyCPI, monthsFromRetirement));

    results.push({
      year,
      withdrawalAmount: round2(netWithdrawal),
      pvAtRetirement,
      pvAtNow,
      remainingAssets: round2(assets),
      etfGrowth: round2(etfGrowth),
      monthlyAvailable: round2(monthlyAvailable),
      monthlyAvailablePVNow: monthlyPVNow,
      monthlyAvailablePV60: monthlyPV60,
    });
  }

  return results;
}

/**
 * 策略三：等現值提領
 *
 * 退休後每年年初領出一筆金額，使每年的領出金額回算到退休之日的現值 (PV@60) 儘量相等
 * 壽命結束時遺產歸零
 *
 * 這類似年金的計算方式：
 * 資產 = PV × Σ[(1+g)^t / (1+r)^t] for t = 0 to N-1
 * 其中 g 是 ETF 年增長率, r 是 CPI 年率
 *
 * 簡化方法：用年金現值因子來求解每年等現值的名目提領金額
 * PV@60 = totalAssets / annuity_factor
 * 第 t 年的名目提領 = PV@60 × (1+CPI_annual)^t
 *
 * 但因為資產在 ETF 中持續增長，我們需要迭代模擬並以二分搜尋找到使遺產歸零的 PV@60
 */
function simulateConstantPV(
  totalAssets: number,
  etf: ETFProduct,
  retirementDate: Date,
  distributionYears: number,
  monthlyCPI: number,
  annualCPI: number,
  investmentPeriodMonths: number,
  laborInsuranceMonthly: number,
  nationalPensionMonthly: number,
): AnnualWithdrawal[] {
  // 用二分搜尋找到使壽命結束時遺產歸零的 PV@60 值
  let low = 0;
  let high = totalAssets; // PV@60 不可能超過總資產
  const tolerance = 1; // 容許誤差 1 元

  // 模擬函數：給定 PV@60，返回壽命結束時的剩餘資產及是否所有年份都足額提領
  function simulateWithPV(pvAt60: number): {
    remaining: number;
    fullyFunded: boolean;
    withdrawals: AnnualWithdrawal[];
  } {
    const results: AnnualWithdrawal[] = [];
    let assets = totalAssets;
    let retirementMonth = retirementDate.getMonth() + 1;
    let fullyFunded = true;

    for (let year = 1; year <= distributionYears; year++) {
      // 第 year 年的名目提領金額 = PV@60 × (1+CPI)^(year-1)
      const nominalWithdrawal = pvAt60 * Math.pow(1 + annualCPI, year - 1);

      // 實際需要從 ETF 中賣出的金額（考慮賣出費用）
      // grossSell = nominalWithdrawal / (1 - sellFeeRate)
      const grossSell = nominalWithdrawal / (1 - 0.002425);
      const actualWithdrawal = Math.min(grossSell, assets);
      if (actualWithdrawal < grossSell - 0.01) {
        fullyFunded = false;
      }
      const netWithdrawal = calculateSellProceeds(actualWithdrawal);
      assets -= actualWithdrawal;

      if (assets < 0) assets = 0;

      // 當年 ETF 增長
      let currentMonth = retirementMonth;
      let yearStartAssets = assets;
      for (let m = 0; m < 12; m++) {
        const result = simulateMonthGrowth(assets, etf, currentMonth);
        assets = result.newPrincipal;
        currentMonth++;
        if (currentMonth > 12) currentMonth = 1;
      }
      const etfGrowth = assets - yearStartAssets;

      const monthlyFromWithdrawal = netWithdrawal / 12;
      const monthlyAvailable = monthlyFromWithdrawal + laborInsuranceMonthly + nationalPensionMonthly;

      const monthsFromRetirement = (year - 1) * 12;
      const monthsFromNow = investmentPeriodMonths + monthsFromRetirement;

      const pvAtRetirement = round2(netWithdrawal / Math.pow(1 + monthlyCPI, monthsFromRetirement));
      const pvAtNow = round2(netWithdrawal / Math.pow(1 + monthlyCPI, monthsFromNow));

      const monthlyPVNow = round2(monthlyAvailable / Math.pow(1 + monthlyCPI, monthsFromNow));
      const monthlyPV60 = round2(monthlyAvailable / Math.pow(1 + monthlyCPI, monthsFromRetirement));

      results.push({
        year,
        withdrawalAmount: round2(netWithdrawal),
        pvAtRetirement,
        pvAtNow,
        remainingAssets: round2(assets),
        etfGrowth: round2(etfGrowth),
        monthlyAvailable: round2(monthlyAvailable),
        monthlyAvailablePVNow: monthlyPVNow,
        monthlyAvailablePV60: monthlyPV60,
      });
    }

    return { remaining: assets, fullyFunded, withdrawals: results };
  }

  // 二分搜尋：找到使遺產趨近零且所有年份都足額提領的 PV@60
  for (let iter = 0; iter < 100; iter++) {
    const mid = (low + high) / 2;
    const { remaining, fullyFunded } = simulateWithPV(mid);

    if (fullyFunded && Math.abs(remaining) < tolerance) {
      break;
    }

    if (!fullyFunded || remaining < 0) {
      // 資產在某年不足，需要降低提領
      high = mid;
    } else {
      // 還有剩餘，可以提領更多
      low = mid;
    }
  }

  const finalPV = (low + high) / 2;
  return simulateWithPV(finalPV).withdrawals;
}

/**
 * 計算 Module B 的完整結果
 */
export function calculateDistribution(
  accResult: AccumulationResult,
  distSettings: DistributionSettings,
  basicSettings: BasicSettings,
  derived: DerivedCalculations,
): DistributionResult {
  // 計算退休當下總資產
  const totalRetirementAssets = calculateTotalRetirementAssets(
    accResult,
    distSettings,
    basicSettings,
    derived,
  );

  const distributionYears = Math.ceil(derived.distributionPeriodMonths / 12);
  const etf = distSettings.retirementETF;

  let annualWithdrawals: AnnualWithdrawal[];

  switch (distSettings.strategy) {
    case 'fixed-rate':
      annualWithdrawals = simulateFixedRate(
        totalRetirementAssets,
        distSettings.withdrawalRate!,
        etf,
        derived.retirementDate,
        distributionYears,
        derived.monthlyCPI,
        derived.investmentPeriodMonths,
        distSettings.laborInsuranceMonthly,
        distSettings.nationalPensionMonthly,
      );
      break;

    case 'increasing-rate':
      annualWithdrawals = simulateIncreasingRate(
        totalRetirementAssets,
        distSettings.withdrawalRate!,
        etf,
        derived.retirementDate,
        distributionYears,
        derived.monthlyCPI,
        derived.investmentPeriodMonths,
        distSettings.laborInsuranceMonthly,
        distSettings.nationalPensionMonthly,
      );
      break;

    case 'constant-pv':
      annualWithdrawals = simulateConstantPV(
        totalRetirementAssets,
        etf,
        derived.retirementDate,
        distributionYears,
        derived.monthlyCPI,
        basicSettings.annualCPI,
        derived.investmentPeriodMonths,
        distSettings.laborInsuranceMonthly,
        distSettings.nationalPensionMonthly,
      );
      break;
  }

  // 壽命結束時的遺產
  const lastYear = annualWithdrawals[annualWithdrawals.length - 1];
  const estate = lastYear ? lastYear.remainingAssets : 0;

  return {
    totalRetirementAssets: round2(totalRetirementAssets),
    annualWithdrawals,
    estate: round2(estate),
  };
}
