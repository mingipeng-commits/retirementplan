import { BasicSettings, DerivedCalculations } from './types';

/**
 * 驗證基本設定值的有效性
 */
export function validateBasicSettings(settings: BasicSettings): string[] {
  const errors: string[] = [];

  if (settings.retirementAge < 40 || settings.retirementAge > 70) {
    errors.push('退休年齡必須在 40 至 70 歲之間');
  }

  if (settings.lifeExpectancy < 50 || settings.lifeExpectancy > 100) {
    errors.push('預期壽命必須在 50 至 100 歲之間');
  }

  if (settings.annualCPI < 0 || settings.annualCPI > 0.10) {
    errors.push('年 CPI 必須在 0% 至 10% 之間');
  }

  if (settings.birthDate >= settings.calculationDate) {
    errors.push('出生日期必須早於計算日期');
  }

  if (settings.lifeExpectancy <= settings.retirementAge) {
    errors.push('預期壽命必須大於退休年齡');
  }

  return errors;
}

/**
 * 計算兩個日期之間的月數差（精確到小數點後兩位）
 * 以完整月數 + 剩餘天數佔該月天數的比例計算
 */
export function calcMonthsDiff(startDate: Date, endDate: Date): number {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startDay = startDate.getDate();

  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();
  const endDay = endDate.getDate();

  // 完整月數
  let fullMonths = (endYear - startYear) * 12 + (endMonth - startMonth);

  // 處理日的差異
  if (endDay >= startDay) {
    // 當月的天數中，已經過了多少天
    const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
    const fractionalMonth = (endDay - startDay) / daysInEndMonth;
    return round2(fullMonths + fractionalMonth);
  } else {
    // endDay < startDay，需要退一個月
    fullMonths -= 1;
    // 取上個月的總天數來計算剩餘天數
    const daysInPrevMonth = new Date(endYear, endMonth, 0).getDate();
    const remainingDays = (daysInPrevMonth - startDay) + endDay;
    const fractionalMonth = remainingDays / daysInPrevMonth;
    return round2(fullMonths + fractionalMonth);
  }
}

/**
 * 四捨五入到小數點後兩位
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * 在出生日期上加上指定年數，得到確切日期
 */
export function addYearsToDate(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * 將年利率轉換為月利率
 * MCPI = (1+CPI)^(1/12) - 1
 */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * 根據基本設定計算衍生值
 */
export function calculateDerived(settings: BasicSettings): DerivedCalculations {
  const errors = validateBasicSettings(settings);
  if (errors.length > 0) {
    throw new Error(`設定驗證失敗: ${errors.join('; ')}`);
  }

  // 退休日期 = 出生日 + 退休年齡
  const retirementDate = addYearsToDate(settings.birthDate, settings.retirementAge);

  // 預期壽命到達日期 = 出生日 + 預期壽命
  const lifeEndDate = addYearsToDate(settings.birthDate, settings.lifeExpectancy);

  // 今日用戶年紀（月）
  const totalAgeMonths = calcMonthsDiff(settings.birthDate, settings.calculationDate);
  const ageYears = Math.floor(totalAgeMonths / 12);
  const ageMonths = round2(totalAgeMonths % 12);

  // 目前到退休之日的時長 IP（月）
  const investmentPeriodMonths = calcMonthsDiff(settings.calculationDate, retirementDate);

  // 退休至到達預期壽命之間的時長 DP（月）
  const distributionPeriodMonths = calcMonthsDiff(retirementDate, lifeEndDate);

  // 月 CPI
  const monthlyCPI = annualToMonthlyRate(settings.annualCPI);

  return {
    ageYears,
    ageMonths,
    ageDescription: `${ageYears}年 ${ageMonths}月`,
    investmentPeriodMonths,
    distributionPeriodMonths,
    monthlyCPI,
    retirementDate,
    lifeEndDate,
  };
}
