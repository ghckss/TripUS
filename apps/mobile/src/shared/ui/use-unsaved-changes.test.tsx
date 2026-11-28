import { act, renderHook } from "@testing-library/react-native";
import { useUnsavedChanges } from "./use-unsaved-changes";

let mockCallback: (event: { repeat: () => void }) => void;
let mockProtected: boolean;
const mockDisable = jest.fn(); const mockDialog = jest.fn();
jest.mock("expo-router", () => ({ usePreventRemove: (protectedScreen: boolean, callback: typeof mockCallback) => {
  mockProtected = protectedScreen; mockCallback = callback; return mockDisable;
} }));
jest.mock("./app-dialog", () => ({ useAppDialog: () => ({ showDialog: mockDialog }) }));
beforeEach(() => jest.clearAllMocks());
it("keeps dirty changes until the user explicitly confirms leaving", async () => {
  await renderHook(() => useUnsavedChanges(true));
  const repeat = jest.fn();
  await act(() => mockCallback({ repeat }));
  expect(mockProtected).toBe(true); expect(repeat).not.toHaveBeenCalled();
  const actions = mockDialog.mock.calls[0][0].actions;
  expect(actions[0].label).toBe("계속 작성");
  expect(actions[0].variant).toBe("success");
  expect(actions[1].label).toBe("나가기");
  expect(actions[1].variant).toBe("danger");
  await act(() => actions[1].onPress());
  expect(repeat).toHaveBeenCalledTimes(1); expect(mockProtected).toBe(false);
});
it("allows a successful save to close without another warning", async () => {
  const { result } = await renderHook(() => useUnsavedChanges(true));
  await act(() => result.current());
  expect(mockDisable).toHaveBeenCalledTimes(1); expect(mockProtected).toBe(false);
});
