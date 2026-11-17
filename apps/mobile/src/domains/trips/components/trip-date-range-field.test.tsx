import { fireEvent, render } from "@testing-library/react-native";
import { TripDateRangeField } from "./trip-date-range-field";

it("applies a date range across months only after confirmation", async () => {
  const onChange = jest.fn();
  const screen = await render(<TripDateRangeField startDate="2026-11-15" endDate="2026-11-17" onChange={onChange} />);
  await fireEvent.press(screen.getByTestId("trip-date-range"));
  await fireEvent.press(screen.getByTestId("trip-date-range-day-2026-11-29"));
  expect(screen.getByTestId("trip-date-range-apply")).toBeDisabled();
  await fireEvent.press(screen.getByLabelText("다음 달"));
  await fireEvent.press(screen.getByTestId("trip-date-range-day-2026-12-02"));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId("trip-date-range-apply"));
  expect(onChange).toHaveBeenCalledWith({ startDate: "2026-11-29", endDate: "2026-12-02" });
});
it("restarts from an earlier date and supports a single-day trip", async () => {
  const onChange = jest.fn();
  const screen = await render(<TripDateRangeField startDate="2026-11-15" endDate="2026-11-17" onChange={onChange} />);
  await fireEvent.press(screen.getByTestId("trip-date-range"));
  await fireEvent.press(screen.getByTestId("trip-date-range-day-2026-11-20"));
  await fireEvent.press(screen.getByTestId("trip-date-range-day-2026-11-18"));
  expect(screen.getByTestId("trip-date-range-apply")).toBeDisabled();
  await fireEvent.press(screen.getByTestId("trip-date-range-day-2026-11-18"));
  await fireEvent.press(screen.getByTestId("trip-date-range-apply"));
  expect(onChange).toHaveBeenCalledWith({ startDate: "2026-11-18", endDate: "2026-11-18" });
});
it("discards cancelled selections when reopened", async () => {
  const onChange = jest.fn();
  const screen = await render(<TripDateRangeField startDate="2026-11-15" endDate="2026-11-17" onChange={onChange} />);
  await fireEvent.press(screen.getByTestId("trip-date-range"));
  await fireEvent.press(screen.getByTestId("trip-date-range-day-2026-11-20"));
  await fireEvent.press(screen.getByRole("button", { name: "취소" }));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId("trip-date-range"));
  await fireEvent.press(screen.getByTestId("trip-date-range-apply"));
  expect(onChange).toHaveBeenCalledWith({ startDate: "2026-11-15", endDate: "2026-11-17" });
});
