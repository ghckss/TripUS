import { timeoutManager } from "@tanstack/react-query";
import { cleanup } from "@testing-library/react-native";
import { queryClient, setAccountScope } from "./src/shared/query/query-client";

// Query garbage-collection timers must not keep the Jest process alive.
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); (timer as unknown as { unref?: () => void }).unref?.(); return timer; },
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  setInterval: (callback, delay) => { const timer = setInterval(callback, delay); (timer as unknown as { unref?: () => void }).unref?.(); return timer; },
  clearInterval: (timer) => clearInterval(timer as ReturnType<typeof setInterval>),
});

afterEach(async () => {
  await cleanup();
  queryClient.clear();
  setAccountScope();
});
