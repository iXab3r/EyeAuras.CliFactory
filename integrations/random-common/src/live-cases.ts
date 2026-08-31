export interface LiveCase {
  name: string;
  argv: readonly string[];
  count: number;
  min: number;
  max: number;
  unique: boolean;
}

export const liveCases: readonly LiveCase[] = [
  {
    name: "integers: count and signed range",
    argv: ["integers", "--count", "5", "--min", "-3", "--max", "3"],
    count: 5,
    min: -3,
    max: 3,
    unique: false,
  },
  {
    name: "integers: repeated values in a two-value range",
    argv: ["integers", "--count", "3", "--min", "0", "--max", "1"],
    count: 3,
    min: 0,
    max: 1,
    unique: false,
  },
  {
    name: "sequence: entire signed interval without duplicates",
    argv: ["sequence", "--min", "-2", "--max", "2"],
    count: 5,
    min: -2,
    max: 2,
    unique: true,
  },
  {
    name: "sequence: minimal two-item interval",
    argv: ["sequence", "--min", "0", "--max", "1"],
    count: 2,
    min: 0,
    max: 1,
    unique: true,
  },
];
