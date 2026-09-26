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

const durationSyntax = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

/** `90s`, `10m` or `1h30m` in milliseconds within inclusive millisecond bounds. */
export function durationParser({ min, max, errorMessage }: {
  min: number;
  max: number;
  errorMessage: string;
}): (value: string) => number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min > max) {
    throw new Error("Duration parser bounds must be ordered nonnegative safe integers.");
  }
  return value => {
    const match = durationSyntax.exec(value);
    const [, hours = "0", minutes = "0", seconds = "0"] = match ?? [];
    const milliseconds = ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
    if (!match || value === "" || !Number.isSafeInteger(milliseconds) || milliseconds < min ||
      milliseconds > max) {
      throw new Error(errorMessage);
    }
    return milliseconds;
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
