import { describe, it, expect } from "vitest";
import { formatMinutesAsTime, formatAvailabilityWindows } from "@/lib/appointments/schedule-format";

describe("formatMinutesAsTime", () => {
  it("formats an on-the-hour morning time", () => {
    expect(formatMinutesAsTime(9 * 60, "en-US")).toBe("9:00 AM");
  });

  it("formats a half-hour afternoon time", () => {
    expect(formatMinutesAsTime(13 * 60 + 30, "en-US")).toBe("1:30 PM");
  });

  it("formats midnight (0 minutes)", () => {
    expect(formatMinutesAsTime(0, "en-US")).toBe("12:00 AM");
  });

  it("formats the last minute of the day (1439)", () => {
    expect(formatMinutesAsTime(1439, "en-US")).toBe("11:59 PM");
  });
});

describe("formatAvailabilityWindows", () => {
  it("returns an empty array for no windows", () => {
    expect(formatAvailabilityWindows([], "en-US")).toEqual([]);
  });

  it("formats a single window as a start–end range", () => {
    expect(formatAvailabilityWindows([{ startMinutes: 540, endMinutes: 780 }], "en-US")).toEqual(["9:00 AM–1:00 PM"]);
  });

  it("formats a split-shift as two separate ranges, in the given order", () => {
    expect(
      formatAvailabilityWindows(
        [
          { startMinutes: 540, endMinutes: 780 },
          { startMinutes: 840, endMinutes: 1080 },
        ],
        "en-US",
      ),
    ).toEqual(["9:00 AM–1:00 PM", "2:00 PM–6:00 PM"]);
  });
});
