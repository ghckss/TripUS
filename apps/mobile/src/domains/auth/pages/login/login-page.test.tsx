import { render } from "@testing-library/react-native";

import LoginScreen from "./login-page";
import { useLogin } from "./use-login";

jest.mock("./use-login", () => ({ useLogin: jest.fn() }));

const mockUseLogin = jest.mocked(useLogin);

describe("LoginScreen", () => {
  beforeEach(() => {
    mockUseLogin.mockReturnValue({
      error: undefined,
      googleConfigured: true,
      loading: undefined,
      loginForDevelopment: jest.fn(),
      loginWithApple: jest.fn(),
      loginWithGoogle: jest.fn(),
    });
  });

  it("shows a Google-branded button without the social-login helper copy", async () => {
    const screen = await render(<LoginScreen />);

    expect(screen.getByLabelText("Google로 계속하기")).toBeTruthy();
    expect(screen.getByTestId("login-google-mark")).toBeTruthy();
    expect(screen.queryByText("소셜 계정으로 안전하게 로그인하고 여행 기록을 동기화하세요.")).toBeNull();
  });
});
