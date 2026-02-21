/**
 * 退休計算機 - 主要入口
 *
 * 模組結構：
 * - basicSettings: 基本設定與衍生計算
 * - etfModel: ETF 投資模型（CAGR、配息、交易成本）
 * - moduleA: 積累模組（一次性投入與定期定額）
 * - moduleB: 分配模組（三種提領策略、養老金、月可用金額）
 */

export {
  BasicSettings,
  DerivedCalculations,
  ETFProduct,
  DividendFrequency,
  LumpSumInvestment,
  DCAInvestment,
  AccumulationSettings,
  AccumulationResult,
  DistributionSettings,
  DistributionResult,
  AnnualWithdrawal,
  WithdrawalStrategy,
  RetirementCalculationResult,
} from './types';

export {
  validateBasicSettings,
  calculateDerived,
  calcMonthsDiff,
  round2,
  addYearsToDate,
  annualToMonthlyRate,
} from './basicSettings';

export {
  calculateETFDerived,
  calculateBuyAmount,
  calculateSellProceeds,
  isDividendMonth,
  getSingleDividendRate,
  simulateMonthGrowth,
  simulateGrowth,
} from './etfModel';

export {
  simulateLumpSum,
  simulateDCA,
  calculateAccumulation,
} from './moduleA';

export {
  calculateTotalRetirementAssets,
  calculateDistribution,
} from './moduleB';

import { BasicSettings, AccumulationSettings, DistributionSettings, RetirementCalculationResult } from './types';
import { calculateDerived } from './basicSettings';
import { calculateAccumulation } from './moduleA';
import { calculateDistribution } from './moduleB';

/**
 * 執行完整的退休計算
 *
 * @param basicSettings 基本設定
 * @param accSettings Module A 積累設定
 * @param distSettings Module B 分配設定
 * @returns 完整計算結果
 */
export function calculateRetirement(
  basicSettings: BasicSettings,
  accSettings: AccumulationSettings,
  distSettings: DistributionSettings,
): RetirementCalculationResult {
  // 1. 計算衍生值
  const derived = calculateDerived(basicSettings);

  // 2. Module A: 積累
  const accumulation = calculateAccumulation(accSettings, basicSettings, derived);

  // 3. Module B: 分配
  const distribution = calculateDistribution(accumulation, distSettings, basicSettings, derived);

  return {
    derived,
    accumulation,
    distribution,
  };
}
