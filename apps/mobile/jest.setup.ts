jest.mock(
  "@react-native-community/netinfo",
  () => require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MapView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      fitToCoordinates: jest.fn(),
    }));
    return React.createElement(View, props, props.children);
  });
  const Marker = (props: Record<string, unknown>) => React.createElement(View, props, props.children);
  Marker.Animated = Marker;

  class AnimatedRegion {
    private value: Record<string, number>;

    constructor(value: Record<string, number>) {
      this.value = value;
    }

    setValue(value: Record<string, number>) {
      this.value = value;
    }

    stopAnimation(callback?: (value: Record<string, number>) => void) {
      callback?.(this.value);
    }

    timing() {
      return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    }
  }

  return {
    __esModule: true,
    default: MapView,
    AnimatedRegion,
    Marker,
    Polyline: View,
    PROVIDER_GOOGLE: "google",
  };
});
