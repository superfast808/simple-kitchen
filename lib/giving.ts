import { DateTime } from "luxon";
import { config } from "./config";

export function givingIsActive() {
  if (!config.givingEnabled) return false;
  const now = DateTime.now().setZone("Europe/London").toISODate() || "";
  return now >= config.givingStart && now <= config.givingEnd;
}

export function roundUpDonationPence(amountPence: number) {
  const remainder = ((amountPence % 100) + 100) % 100;
  return remainder === 0 ? 100 : 100 - remainder;
}
