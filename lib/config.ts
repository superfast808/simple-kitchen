const money = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Math.round(fallback * 100);
};
const integer = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  weeklyItemCap: integer(process.env.WEEKLY_ITEM_CAP, 200),
  deliverySlotCap: integer(process.env.DELIVERY_SLOT_CAP, 75),
  deliveryFeePence: money(process.env.DELIVERY_FEE, 3),
  minimumOrderPence: money(process.env.MINIMUM_ORDER_AMOUNT, 0),
  givingEnabled: process.env.CHRISTMAS_GIVING_ENABLED === "true",
  givingStart: process.env.GIVING_START || "2026-11-01",
  givingEnd: process.env.GIVING_END || "2026-12-24"
};

export function subscriptionOptions() {
  const raw = process.env.SUBSCRIPTION_OPTIONS || "5:37.50,6:45.00,7:52.50,10:75.00";
  return raw.split(",").map((part) => {
    const [mealsRaw, priceRaw] = part.split(":");
    return { meals: Number(mealsRaw), weeklyPence: money(priceRaw, 0) };
  }).filter((option) => Number.isInteger(option.meals) && option.meals > 0 && option.weeklyPence > 0);
}
