/** Decimal integer syntax and bounds only; callers supply a static, non-secret error message. */
export function integerParser({ min, max, signed, errorMessage }: {
  min: number;
  max: number;
  signed: boolean;
  errorMessage: string;
}): (value: string) => number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new Error("Integer parser bounds must be ordered safe integers.");
  }
  const syntax = signed ? /^-?\d+$/ : /^\d+$/;
  return value => {
    const number = Number(value);
    if (!syntax.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
      throw new Error(errorMessage);
    }
    return number;
  };
}

/** Parse JSON to unknown, without exposing the input or the native parser's error/cause. */
export function jsonParser(errorMessage: string): (value: string) => unknown {
  return value => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(errorMessage);
    }
  };
}
