/**
 * 退休計算機核心型別定義
 */

/** 基本設定 */
export interface BasicSettings {
  /** 出生年月日 (BD) */
  birthDate: Date;
  /** 使用本計算機的日期 (TD) */
  calculationDate: Date;
  /** 預計退休的年齡 RA 歲 (40 <= RA <= 70) */
  retirementAge: number;
  /** 預期壽命 LS 歲 (50 <= LS <= 100) */
  lifeExpectancy: number;
  /** 年 CPI (0% <= CPI <= 10%，預設值為 2%) */
  annualCPI: number;
}

/** 衍生計算結果 */
export interface DerivedCalculations {
  /** 今日用戶年紀 (年) */
  ageYears: number;
  /** 今日用戶年紀 (月，小數點後兩位) */
  ageMonths: number;
  /** 今日用戶年紀完整描述 AY年 AM月 */
  ageDescription: string;
  /** 目前到退休之日的時長 IP (月) */
  investmentPeriodMonths: number;
  /** 退休至到達預期壽命之間的時長 DP (月) */
  distributionPeriodMonths: number;
  /** 月 CPI (MCPI) */
  monthlyCPI: number;
  /** 退休日期 */
  retirementDate: Date;
  /** 預期壽命到達日期 */
  lifeEndDate: Date;
}

/** ETF 配息頻率 */
export type DividendFrequency = 'semi-annual' | 'quarterly';

/** ETF 商品定義 */
export interface ETFProduct {
  /** ETF 名稱 */
  name: string;
  /** 年 CAGR (本金成長率) */
  annualCAGR: number;
  /** 年配息率均值 LAIR */
  annualLAIR: number;
  /** 配息頻率 */
  dividendFrequency: DividendFrequency;
}

/** ETF 衍生計算值 */
export interface ETFDerived {
  /** 月 CAGR (MCAGR) */
  monthlyCAGR: number;
  /** 買入手續費率 (0.1425%) */
  buyFeeRate: number;
  /** 賣出費率 (0.1425% + 0.1%) */
  sellFeeRate: number;
}

/** Module A: 一次性投入 */
export interface LumpSumInvestment {
  /** 購買金額 */
  amount: number;
  /** 選擇的 ETF 商品 */
  etf: ETFProduct;
}

/** Module A: 定期定額投入 */
export interface DCAInvestment {
  /** 每月月初購買金額 */
  monthlyAmount: number;
  /** 選擇的 ETF 商品 */
  etf: ETFProduct;
}

/** Module A 設定 */
export interface AccumulationSettings {
  /** 一次性投入（可多筆） */
  lumpSumInvestments: LumpSumInvestment[];
  /** 定期定額投入（可多筆） */
  dcaInvestments: DCAInvestment[];
}

/** 退休後提領策略 */
export type WithdrawalStrategy = 'fixed-rate' | 'increasing-rate' | 'constant-pv';

/** Module B: 分配設定 */
export interface DistributionSettings {
  /** 提領策略 */
  strategy: WithdrawalStrategy;
  /** 固定提領比率 x% (1% <= x <= 12%)，用於 fixed-rate 和 increasing-rate 策略 */
  withdrawalRate?: number;
  /** 退休當下歸戶之被動 ETF 商品 */
  retirementETF: ETFProduct;
  /** 新制勞退一次領出總金額（固定在滿 60 歲時提領） */
  laborPensionLumpSum: number;
  /** 其他在退休當下可以歸戶的資產 */
  otherAssets: number;
  /** 勞保老年年金月付金額 */
  laborInsuranceMonthly: number;
  /** 國民年金月付金額 */
  nationalPensionMonthly: number;
}

/** 單月結果快照 */
export interface MonthlySnapshot {
  /** 第幾個月 (1-based) */
  month: number;
  /** 月初本金 */
  principalStart: number;
  /** 月底本金 (含 CAGR 增長) */
  principalEnd: number;
  /** 當月配息金額 (若有) */
  dividend: number;
  /** 當月新投入金額 (若有) */
  contribution: number;
}

/** Module A 計算結果 */
export interface AccumulationResult {
  /** 所有一次性投入在退休當下的累積總值 */
  lumpSumTotal: number;
  /** 所有定期定額投入在退休當下的累積總值 */
  dcaTotal: number;
  /** 退休當下可分配財產總額 */
  totalAtRetirement: number;
}

/** 年度提領結果 */
export interface AnnualWithdrawal {
  /** 第幾年 (1-based) */
  year: number;
  /** 年初提領金額 */
  withdrawalAmount: number;
  /** 提領金額折算 PV@退休日 */
  pvAtRetirement: number;
  /** 提領金額折算 PV@今日 */
  pvAtNow: number;
  /** 提領後剩餘資產 */
  remainingAssets: number;
  /** 當年 ETF 增長與配息 */
  etfGrowth: number;
  /** 月可用金額 (提領/12 + 勞保 + 國民年金) */
  monthlyAvailable: number;
  /** 月可用金額 PV@NOW */
  monthlyAvailablePVNow: number;
  /** 月可用金額 PV@60 */
  monthlyAvailablePV60: number;
}

/** Module B 計算結果 */
export interface DistributionResult {
  /** 退休當下總資產 (含勞退、其他資產) */
  totalRetirementAssets: number;
  /** 各年提領明細 */
  annualWithdrawals: AnnualWithdrawal[];
  /** 壽命結束時的遺產 */
  estate: number;
}

/** 完整計算結果 */
export interface RetirementCalculationResult {
  /** 衍生計算值 */
  derived: DerivedCalculations;
  /** Module A 結果 */
  accumulation: AccumulationResult;
  /** Module B 結果 */
  distribution: DistributionResult;
}
