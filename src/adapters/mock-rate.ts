import type { RateProvider } from "../core/ports";

export function mockRate(sample: { cents: number; currency: string }): RateProvider {
  return { rate: async () => ({ ...sample }) };
}
