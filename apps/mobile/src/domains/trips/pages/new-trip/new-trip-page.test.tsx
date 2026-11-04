import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import NewTripScreen from "./new-trip-page";

const mockCreateTrip = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock("@/domains/entitlements/api/entitlements.api", () => ({
  getEntitlements: jest.fn().mockResolvedValue({ tier: "free", tripLimit: 1, tripCount: 0, aiGenerationLimit: 1, aiGenerationsUsed: 0 }),
}));
jest.mock("@/domains/trips/api/trips.api", () => ({
  createTrip: (...args: unknown[]) => mockCreateTrip(...args),
}));

describe("NewTripScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a trip from the edited form and opens its detail", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "부산 주말 여행");
    await fireEvent.changeText(screen.getByTestId("new-trip-destination"), "부산");
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    await waitFor(() => expect(mockCreateTrip).toHaveBeenCalledWith({
      destination: "부산",
      endDate: "2026-11-02",
      startDate: "2026-10-31",
      timezone: "Asia/Seoul",
      title: "부산 주말 여행",
    }));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1");
  });

  it("keeps the form visible when creation fails", async () => {
    mockCreateTrip.mockRejectedValue(new Error("서버에 연결하지 못했어요."));
    const screen = await render(<NewTripScreen />);

    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    expect(await screen.findByText("서버에 연결하지 못했어요.")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
