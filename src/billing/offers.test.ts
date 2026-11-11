import { describe, expect, it } from "vitest";

import { offersFrom } from "./offers";

const pkg = (identifier: string, priceString: string) => ({ identifier, product: { priceString } });

describe("offersFrom", () => {
  it("lists Plus then Pro, monthly then annual, from the plus and pro offerings", () => {
    const offers = offersFrom({
      all: {
        pro: { monthly: pkg("pro_m", "$9.99"), annual: pkg("pro_y", "$99.99") },
        plus: { monthly: pkg("plus_m", "$4.99"), annual: null },
        default: { monthly: pkg("other", "$1.00"), annual: null },
      },
    });
    expect(offers.map(({ plan, billing, price }) => [plan, billing, price])).toEqual([
      ["plus", "monthly", "$4.99"],
      ["pro", "monthly", "$9.99"],
      ["pro", "annual", "$99.99"],
    ]);
  });

  it("offers nothing when the store has no plan offerings", () => {
    expect(offersFrom({ all: {} })).toEqual([]);
  });
});
