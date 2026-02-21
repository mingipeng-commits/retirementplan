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
  ConfidenceLevel,
  LumpSumInvestment,
  DCAInvestment,
  AccumulationSettings,
  AccumulationResult,
  DistributionSettings,
  DistributionResult,
  AnnualWithdrawal,
  WithdrawalStrategy,
  RetirementCalculationResult,
  MonthlyDetail,
  InvestmentSimResult,
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
  applyConfidence,
  CONFIDENCE_MULTIPLIERS,
} from './etfModel';

export {
  simulateLumpSum,
  simulateLumpSumDetailed,
  simulateDCA,
  simulateDCADetailed,
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
 */
export function calculateRetirement(
  basicSettings: BasicSettings,
  accSettings: AccumulationSettings,
  distSettings: DistributionSettings,
): RetirementCalculationResult {
  const derived = calculateDerived(basicSettings);
  const accumulation = calculateAccumulation(accSettings, basicSettings, derived);
  const distribution = calculateDistribution(accumulation, distSettings, basicSettings, derived);

  return {
    derived,
    accumulation,
    distribution,
  };
}
