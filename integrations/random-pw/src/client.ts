import {
  BrowserRuntime,
  BrowserOperationError,
  type BrowserProfile,
  type BrowserOperationOptions,
} from "@eyeauras/cli-factory-playwright";
import {
  RandomRequestState,
  integerRequest,
  parseRandomValues,
  sequenceRequest,
  type IntegerRequest,
  type RandomClient,
  type RandomRange,
  type RandomValues,
} from "@eyeauras/random-common";

export class RandomBrowserClient implements RandomClient {
  constructor(
    private readonly runtime: BrowserRuntime,
    private readonly profile: BrowserProfile,
    private readonly options: BrowserOperationOptions = {},
    private readonly state = new RandomRequestState(),
  ) {
    this.options = { ...options };
  }
  integers(
    request: IntegerRequest,
    signal?: AbortSignal,
  ): Promise<RandomValues> {
    const valid = integerRequest(request);
    return this.#generate("integers", valid, valid.count, false, signal);
  }
  sequence(request: RandomRange, signal?: AbortSignal): Promise<RandomValues> {
    const valid = sequenceRequest(request);
    return this.#generate(
      "sequences",
      valid,
      valid.max - valid.min + 1,
      true,
      signal,
    );
  }
  #generate(
    kind: "integers" | "sequences",
    range: RandomRange,
    count: number,
    unique: boolean,
    signal?: AbortSignal,
  ): Promise<RandomValues> {
    return this.state.run(async () => {
      const bounded = AbortSignal.any([
        ...(signal ? [signal] : []),
        AbortSignal.timeout(240000),
      ]);
      return this.runtime.withPage(
        this.profile,
        bounded,
        async (page) => {
          const quotaResponse = await page.goto("/quota/");
          if (!quotaResponse?.ok())
            throw new BrowserOperationError(
              "RANDOM.ORG quota page is unavailable. No retry was made.",
            );
          const quotaText = await page.locator("body").innerText();
          const match = /Current allowance:\s*([\d,-]+)\s*bits/i.exec(
            quotaText,
          );
          const quota = match ? Number(match[1]!.replaceAll(",", "")) : NaN;
          if (!Number.isSafeInteger(quota))
            throw new BrowserOperationError(
              "RANDOM.ORG returned an invalid quota page.",
            );
          if (quota < 0)
            throw new BrowserOperationError(this.state.exhausted().message);
          const response = await page.goto("/" + kind + "/");
          if (!response?.ok())
            throw new BrowserOperationError(
              "RANDOM.ORG form is unavailable. No retry was made.",
            );
          const consent = page.getByRole("button", {
            name: "Allow Selected",
            exact: true,
          });
          if (await consent.isVisible()) await consent.click();
          const form = page
            .locator("form")
            .filter({ has: page.locator('input[name="min"]') });
          await form.locator('input[name="min"]').fill(String(range.min));
          await form.locator('input[name="max"]').fill(String(range.max));
          await form.locator('input[name="col"]').fill("1");
          if (kind === "integers")
            await form.locator('input[name="num"]').fill(String(count));
          // Exactly one real form submission; browser/network failures never replay generation.
          const [result] = await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            form.locator('input[type="submit"]').click(),
          ]);
          if (!result?.ok())
            throw new BrowserOperationError(
              "RANDOM.ORG generation failed. No retry was made.",
            );
          const text = await page.locator("pre.data").innerText();
          if (text.length > 16384)
            throw new BrowserOperationError(
              "RANDOM.ORG result exceeds the example's size limit.",
            );
          const parsed = parseRandomValues(text, range, count, unique);
          if (!parsed)
            throw new BrowserOperationError(
              "RANDOM.ORG returned invalid random values (count, range or uniqueness).",
            );
          return parsed;
        },
        this.options,
      );
    }, signal);
  }
}
