import {
  BasicSettings,
  DerivedCalculations,
  AccumulationSettings,
  AccumulationResult,
  LumpSumInvestment,
  DCAInvestment,
  MonthlyDetail,
  InvestmentSimResult,
} from './types';
import { calculateBuyAmount, simulateMonthGrowth, applyConfidence } from './etfModel';
import { annualToMonthlyRate, round2 } from './basicSettings';

/**
 * Module A: 積累模組
 *
 * 計算退休當下的可分配財產：
 * 1. 一次性投入在退休當下的本金增值與配息再投入的加總
 * 2. 定期定額投入在退休當下的本金增值與配息再投入的加總
 */

/**
 * 計算單筆一次性投入，回傳最終值與每月明細
 */
export function simulateLumpSum(
  investment: LumpSumInvestment,
  settings: BasicSettings,
  derived: DerivedCalculations,
): number {
  const result = simulateLumpSumDetailed(investment, settings, derived);
  return result.finalValue;
}

/**
 * 計算單筆一次性投入（含每月明細）
 */
export function simulateLumpSumDetailed(
  investment: LumpSumInvestment,
  settings: BasicSettings,
  derived: DerivedCalculations,
): InvestmentSimResult {
  // 套用信心度
  const etf = applyConfidence(investment.etf, investment.confidence);
  const mcagr = annualToMonthlyRate(etf.annualCAGR);
  const mcpi = derived.monthlyCPI;
  const ip = derived.investmentPeriodMonths;

  // 扣除買入手續費
  let principal = calculateBuyAmount(investment.amount);

  const startDate = settings.calculationDate;
  const totalMonths = Math.floor(ip);

  let currentMonth = startDate.getMonth() + 1; // 1-12
  let currentYear = startDate.getFullYear();
  const monthlyDetails: MonthlyDetail[] = [];

  for (let i = 0; i < totalMonths; i++) {
    const beginBalance = principal;

    const result = simulateMonthGrowth(principal, etf, currentMonth);
    const cagrGrowth = principal * mcagr;
    principal = result.newPrincipal;

    // PV 計算：月份 i+1（從現在算起）
    const m = i + 1;
    const pvNow = principal / Math.pow(1 + mcpi, m);
    const pv60 = principal / Math.pow(1 + mcpi, ip);

    monthlyDetails.push({
      month: m,
      calendarYear: currentYear,
      calendarMonth: currentMonth,
      beginBalance: round2(beginBalance),
      purchase: 0,
      cagrGrowth: round2(cagrGrowth),
      dividend: round2(result.dividend),
      endBalance: round2(principal),
      nominal: round2(principal),
      pvNow: round2(pvNow),
      pv60: round2(pv60),
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return { finalValue: principal, monthlyDetails };
}

/**
 * 計算單筆定期定額投入，回傳最終值
 */
export function simulateDCA(
  investment: DCAInvestment,
  settings: BasicSettings,
  derived: DerivedCalculations,
): number {
  const result = simulateDCADetailed(investment, settings, derived);
  return result.finalValue;
}

/**
 * 計算單筆定期定額投入（含每月明細）
 */
export function simulateDCADetailed(
  investment: DCAInvestment,
  settings: BasicSettings,
  derived: DerivedCalculations,
): InvestmentSimResult {
  // 套用信心度
  const etf = applyConfidence(investment.etf, investment.confidence);
  const mcagr = annualToMonthlyRate(etf.annualCAGR);
  const mcpi = derived.monthlyCPI;
  const ip = derived.investmentPeriodMonths;

  const totalMonths = Math.floor(ip);
  let principal = 0;
  let currentMonth = settings.calculationDate.getMonth() + 1;
  let currentYear = settings.calculationDate.getFullYear();
  const monthlyDetails: MonthlyDetail[] = [];

  for (let i = 0; i < totalMonths; i++) {
    const beginBalance = principal;

    // 月初投入：扣除手續費後加入本金
    const contribution = calculateBuyAmount(investment.monthlyAmount);
    principal += contribution;

    // 月底增長與配息
    const principalBeforeGrowth = principal;
    const result = simulateMonthGrowth(principal, etf, currentMonth);
    const cagrGrowth = principalBeforeGrowth * mcagr;
    principal = result.newPrincipal;

    // PV 計算
    const m = i + 1;
    const pvNow = principal / Math.pow(1 + mcpi, m);
    const pv60 = principal / Math.pow(1 + mcpi, ip);

    monthlyDetails.push({
      month: m,
      calendarYear: currentYear,
      calendarMonth: currentMonth,
      beginBalance: round2(beginBalance),
      purchase: round2(contribution),
      cagrGrowth: round2(cagrGrowth),
      dividend: round2(result.dividend),
      endBalance: round2(principal),
      nominal: round2(principal),
      pvNow: round2(pvNow),
      pv60: round2(pv60),
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return { finalValue: principal, monthlyDetails };
}

/**
 * 計算 Module A 的完整結果
 */
export function calculateAccumulation(
  accSettings: AccumulationSettings,
  basicSettings: BasicSettings,
  derived: DerivedCalculations,
): AccumulationResult {
  let lumpSumTotal = 0;
  for (const inv of accSettings.lumpSumInvestments) {
    lumpSumTotal += simulateLumpSum(inv, basicSettings, derived);
  }

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
