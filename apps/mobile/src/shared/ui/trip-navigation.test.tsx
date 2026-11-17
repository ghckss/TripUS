import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { TripNavigation } from "./trip-navigation";

jest.mock("expo-router", () => ({ router: { dismissTo: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

it("opens the chosen screen in the same trip and exposes selection", async () => {
  const screen = await render(<TripNavigation tripId="trip-1" active="home" />);
  expect(screen.getByRole("tab", { name: "여행" }).props.accessibilityState).toEqual({ selected: true });
  await fireEvent.press(screen.getByRole("tab", { name: "장소" }));
  expect(router.dismissTo).toHaveBeenCalledWith("/trips/trip-1/places");
});
it("keeps an active editor in place while allowing its subpage to open the tab root", async () => {
  const screen = await render(<TripNavigation tripId="trip-1" active="itinerary" />);
  await fireEvent.press(screen.getByRole("tab", { name: "일정" }));
  expect(router.dismissTo).not.toHaveBeenCalled();
  await screen.rerender(<TripNavigation tripId="trip-1" active="itinerary" allowActiveNavigation />);
  await fireEvent.press(screen.getByRole("tab", { name: "일정" }));
  expect(router.dismissTo).toHaveBeenCalledWith("/trips/trip-1/itinerary");
});
it("lets an editor resolve unsaved changes before leaving", async () => {
  let proceed: (() => void) | undefined;
  const screen = await render(<TripNavigation tripId="trip-1" active="record" onNavigate={(navigate) => { proceed = navigate; }} />);
  await fireEvent.press(screen.getByRole("tab", { name: "장소" }));
  expect(router.dismissTo).not.toHaveBeenCalled();
  proceed?.();
  expect(router.dismissTo).toHaveBeenCalledWith("/trips/trip-1/places");
});
