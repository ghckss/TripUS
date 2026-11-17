import { TripWorkspaceContext } from "@/shared/ui/trip-workspace";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import TripSummaryScreen from "./trip-summary-page";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), canGoBack: jest.fn().mockReturnValue(false), back: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
  useFocusEffect: jest.fn(),
  Stack: { Screen: ({ options }: { options: { headerLeft: () => React.ReactNode } }) => options.headerLeft() },
}));
jest.mock("./use-trip-summary", () => ({
  useTripSummary: () => ({
    trip: { title: "파리에서의 일주일", startDate: "2026-12-01", endDate: "2026-12-07" },
    itinerary: { items: [] }, photos: [],
  }),
}));

it("shows an icon back control while keeping the trip name in the body", async () => {
  const screen = await render(<TripSummaryScreen />);
  const back = screen.getByRole("button", { name: "뒤로가기" });
  expect(screen.getAllByText("파리에서의 일주일")).toHaveLength(1);
  expect(back).not.toHaveTextContent("파리에서의 일주일");
  await fireEvent.press(back);
  expect(router.replace).toHaveBeenCalledWith("/(tabs)/completed");
});

it("closes the existing workspace instead of replacing the original tab", async () => {
  const close = jest.fn();
  const screen = await render(<TripWorkspaceContext.Provider value={close}><TripSummaryScreen /></TripWorkspaceContext.Provider>);
  await fireEvent.press(screen.getByRole("button", { name: "뒤로가기" }));
  expect(close).toHaveBeenCalledTimes(1);
});
