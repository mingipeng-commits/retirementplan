import { ETFProduct, ETFDerived, DividendFrequency } from './types';
import { annualToMonthlyRate } from './basicSettings';

/** 買入手續費率 0.1425% */
const BUY_FEE_RATE = 0.001425;

/** 賣出費率 0.1425% + 0.1% = 0.2425% */
const SELL_FEE_RATE = 0.001425 + 0.001;

/**
 * 計算 ETF 衍生值
 */
export function calculateETFDerived(etf: ETFProduct): ETFDerived {
  return {
    monthlyCAGR: annualToMonthlyRate(etf.annualCAGR),
    buyFeeRate: BUY_FEE_RATE,
    sellFeeRate: SELL_FEE_RATE,
  };
}

/**
 * 買入 ETF：扣除手續費後的實際投入金額
 */
export function calculateBuyAmount(investmentAmount: number): number {
  return investmentAmount * (1 - BUY_FEE_RATE);
}

/**
 * 賣出 ETF：扣除手續費與證交稅後的實際所得
 */
export function calculateSellProceeds(sellAmount: number): number {
  return sellAmount * (1 - SELL_FEE_RATE);
}

/**
 * 判斷某月是否為配息月
 * @param month 月份 (1-12)
 * @param frequency 配息頻率
 * @returns 是否為配息月
 */
export function isDividendMonth(month: number, frequency: DividendFrequency): boolean {
  if (frequency === 'semi-annual') {
    // 半年配：2月和8月
    return month === 2 || month === 8;
  } else {
    // 季配：3月、6月、9月、12月
    return month === 3 || month === 6 || month === 9 || month === 12;
  }
}

/**
 * 計算單次配息率
 */
export function getSingleDividendRate(etf: ETFProduct): number {
  if (etf.dividendFrequency === 'semi-annual') {
    return etf.annualLAIR / 2;
  } else {
    return etf.annualLAIR / 4;
  }
}

/**
 * 模擬單一 ETF 投資的月度增長
 *
 * @param principal 月初本金
 * @param etf ETF 商品
 * @param calendarMonth 日曆月份 (1-12)
 * @returns { newPrincipal: 月底本金, dividend: 當月配息金額 }
 *
 * 增長規則：
 * 1. 本金成長：月底本金 = 本金 × (1 + MCAGR)
 * 2. 配息：在配息月，配息金額 = 配息發生前一個月的月底本金 × 單次配息率
 *    配息全數滾入月底本金
 *
 * 注意：配息基於「配息發生前一個月的月底本金」，即本月 CAGR 增長前的本金。
 * 但在我們的月度模擬中，配息月的操作順序為：
 *   1. 計算配息金額（基於上月月底本金，即本月月初本金）
 *   2. 本金成長（本月月初本金 × (1+MCAGR)）
 *   3. 配息滾入月底本金
 */
export function simulateMonthGrowth(
  principal: number,
  etf: ETFProduct,
  calendarMonth: number,
): { newPrincipal: number; dividend: number } {
  const mcagr = annualToMonthlyRate(etf.annualCAGR);
  let dividend = 0;

  // 配息：在配息月，以月初本金（即上月月底本金）計算配息
  if (isDividendMonth(calendarMonth, etf.dividendFrequency)) {
    const singleRate = getSingleDividendRate(etf);
    dividend = principal * singleRate;
  }

  // 本金成長
  const grownPrincipal = principal * (1 + mcagr);

  // 配息全數滾入月底本金
  const newPrincipal = grownPrincipal + dividend;

  return { newPrincipal, dividend };
}

/**
 * 模擬 ETF 投資在多個月中的增長
 *
 * @param initialPrincipal 初始本金（已扣除買入手續費）
 * @param etf ETF 商品
 * @param startYear 起始年
 * @param startMonth 起始月 (1-12)
 * @param totalMonths 總月數
 * @returns 最終本金
 */
export function simulateGrowth(
  initialPrincipal: number,
  etf: ETFProduct,
  startYear: number,
  startMonth: number,
  totalMonths: number,
): number {
  let principal = initialPrincipal;
  let currentMonth = startMonth;

  for (let i = 0; i < totalMonths; i++) {
    const result = simulateMonthGrowth(principal, etf, currentMonth);
    principal = result.newPrincipal;

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
    }
  }

  return principal;
}
