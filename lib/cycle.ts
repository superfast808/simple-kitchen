import { DateTime } from "luxon";

const ZONE = "Europe/London";
const DEFAULT_ANCHOR = "2025-03-15";

function anchorDate() {
  const raw = process.env.CYCLE_START_DATE || DEFAULT_ANCHOR;
  return DateTime.fromISO(raw, { zone: ZONE }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
}

export type MenuState = {
  open: boolean;
  week: number;
  message: string;
  windowStart: string;
  windowEnd: string;
  fulfilmentDate: string;
};

export function getMenuState(at = DateTime.now().setZone(ZONE)): MenuState {
  const now = at.setZone(ZONE);
  const anchor = anchorDate();
  const weeksElapsed = Math.max(0, Math.floor(now.diff(anchor, "weeks").weeks));
  const week = (weeksElapsed % 6) + 1;
  const weekday = now.weekday;
  const minutes = now.hour * 60 + now.minute;
  const open = now >= anchor && ((weekday === 6 && minutes >= 720) || weekday === 7 || weekday <= 3);

  let start: DateTime;
  if (open) {
    const daysSinceSaturday = weekday === 7 ? 1 : weekday <= 3 ? weekday + 1 : 0;
    start = now.startOf("day").minus({ days: daysSinceSaturday }).set({ hour: 12 });
  } else {
    let daysToSaturday = (6 - weekday + 7) % 7;
    if (weekday === 6 && minutes >= 720) daysToSaturday = 7;
    start = now.startOf("day").plus({ days: daysToSaturday }).set({ hour: 12 });
  }

  const end = start.plus({ days: 4 }).endOf("day");
  const fulfilment = start.plus({ days: 7 }).startOf("day");

  return {
    open,
    week,
    message: open ? "Orders close at 11:59pm on Wednesday." : "Orders are now closed for this week. The next menu launches Saturday at 12 noon.",
    windowStart: start.toISO() || "",
    windowEnd: end.toISO() || "",
    fulfilmentDate: fulfilment.toISODate() || ""
  };
}
