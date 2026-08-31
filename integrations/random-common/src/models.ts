export interface RandomRange {
  min: number;
  max: number;
}

export interface IntegerRequest extends RandomRange {
  count: number;
}

export interface RandomValues {
  values: number[];
}

/** Service contract shared by command declarations; no HTTP or browser types. */
export interface RandomClient {
  integers(
    request: IntegerRequest,
    signal?: AbortSignal,
  ): Promise<RandomValues>;
  sequence(request: RandomRange, signal?: AbortSignal): Promise<RandomValues>;
}
