import {
  BasicSettings,
  DerivedCalculations,
  AccumulationSettings,
  AccumulationResult,
  LumpSumInvestment,
  DCAInvestment,
  ETFProduct,
} from './types';
import { calculateBuyAmount, simulateMonthGrowth } from './etfModel';

/**
 * Module A: 積累模組
 *
 * 計算退休當下的可分配財產：
 * 1. 一次性投入在退休當下的本金增值與配息再投入的加總
 * 2. 定期定額投入在退休當下的本金增值與配息再投入的加總
 */

/**
 * 計算單筆一次性投入在退休當下的總值
 *
 * 投入時間：計算當日
 * 成長期間：從計算日到退休日（IP 月）
 *
 * @param investment 一次性投入設定
 * @param settings 基本設定
 * @param derived 衍生計算值
 * @returns 退休當下的資產總值
 */
export function simulateLumpSum(
  investment: LumpSumInvestment,
  settings: BasicSettings,
  derived: DerivedCalculations,
): number {
  // 扣除買入手續費
  let principal = calculateBuyAmount(investment.amount);

  const startDate = settings.calculationDate;
  const totalMonths = Math.floor(derived.investmentPeriodMonths);

  let currentMonth = startDate.getMonth() + 1; // 1-12

  for (let i = 0; i < totalMonths; i++) {
    const result = simulateMonthGrowth(principal, investment.etf, currentMonth);
    principal = result.newPrincipal;

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
    }
  }

  return principal;
}

/**
 * 計算單筆定期定額投入在退休當下的總值
 *
 * 投入方式：每月月初投入固定金額（扣除買入手續費後購買 ETF）
 * 投入期間：從計算當日起至退休日止（IP 月）
 * 每月增長：本金 × (1+MCAGR)，配息月份配息全數滾入
 *
 * @param investment 定期定額投入設定
 * @param settings 基本設定
 * @param derived 衍生計算值
 * @returns 退休當下的資產總值
 */
export function simulateDCA(
  investment: DCAInvestment,
  settings: BasicSettings,
  derived: DerivedCalculations,
): number {
  const totalMonths = Math.floor(derived.investmentPeriodMonths);
  let principal = 0;
  let currentMonth = settings.calculationDate.getMonth() + 1; // 1-12

  for (let i = 0; i < totalMonths; i++) {
    // 月初投入：扣除手續費後加入本金
    const contribution = calculateBuyAmount(investment.monthlyAmount);
    principal += contribution;

    // 月底增長與配息
    const result = simulateMonthGrowth(principal, investment.etf, currentMonth);
    principal = result.newPrincipal;

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
    }
  }

  return principal;
}

/**
 * 計算 Module A 的完整結果
 *
 * @param accSettings 積累設定
 * @param basicSettings 基本設定
 * @param derived 衍生計算值
 * @returns 積累結果
 */
export function calculateAccumulation(
  accSettings: AccumulationSettings,
  basicSettings: BasicSettings,
  derived: DerivedCalculations,
): AccumulationResult {
  // 所有一次性投入的加總
  let lumpSumTotal = 0;
  for (const inv of accSettings.lumpSumInvestments) {
    lumpSumTotal += simulateLumpSum(inv, basicSettings, derived);
  }

  // 所有定期定額投入的加總
  let dcaTotal = 0;
  for (const inv of accSettings.dcaInvestments) {
    dcaTotal += simulateDCA(inv, basicSettings, derived);
  }

  return {
    lumpSumTotal,
    dcaTotal,
    totalAtRetirement: lumpSumTotal + dcaTotal,
  };
}
