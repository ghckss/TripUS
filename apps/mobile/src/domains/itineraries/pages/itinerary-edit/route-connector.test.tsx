import { render, screen } from "@testing-library/react-native";
import { RouteConnector } from "./route-connector";

it("shows only a visual line without travel time or route status", async () => {
  await render(<RouteConnector />);

  expect(screen.getByTestId("route-connector")).toBeTruthy();
  expect(screen.queryByText(/분|확인 불가|다시 조회/)).toBeNull();
  expect(screen.queryByLabelText(/이동 시간/)).toBeNull();
});
