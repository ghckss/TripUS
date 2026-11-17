import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const transition = {
    damping: () => transition,
    springify: () => transition,
    stiffness: () => transition,
  };

  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    isSharedValue: (value: unknown) => Boolean(value && typeof value === "object" && "get" in value && "set" in value),
    LinearTransition: transition,
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useComposedEventHandler: () => undefined,
    useEvent: () => jest.fn(),
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    useSharedValue: (initial: unknown) => ({
      value: initial,
      get() { return this.value; },
      set(next: unknown) { this.value = next; },
    }),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

jest.mock("react-native-reanimated-dnd", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Sortable = ({ data, renderItem, useFlatList }: Record<string, any>) => React.createElement(
    View,
    { testID: "mock-sortable", testUseFlatList: useFlatList },
    data.map((item: Record<string, unknown>, index: number) => renderItem({
      item,
      index,
      id: item.id,
      itemsCount: data.length,
    })),
  );
  const SortableItem = ({ children, id, onDragStart, onDrop }: Record<string, any>) => React.createElement(
    View,
    { testID: `sortable-item-${id}`, onDragStart, onDrop },
    children,
  );
  SortableItem.Handle = ({ children }: { children: React.ReactNode }) => children;

  return { __esModule: true, Sortable, SortableItem };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const actual = jest.requireActual("react-native-gesture-handler");
  return {
    ...actual,
    GestureDetector: ({ children, gesture }: { children: React.ReactElement; gesture: unknown }) => React.cloneElement(children, { testGesture: gesture }),
  };
});

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
      getMapBoundaries: jest.fn().mockResolvedValue({ northEast: { latitude: 38, longitude: 128 }, southWest: { latitude: 37, longitude: 126 } }),
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

    timing(config: Record<string, number>) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return {
        start: jest.fn((callback?: (result: { finished: boolean }) => void) => {
          timer = setTimeout(() => {
            this.value = { ...this.value, latitude: config.latitude, longitude: config.longitude };
            callback?.({ finished: true });
          }, config.duration ?? 0);
        }),
        stop: jest.fn(() => { if (timer) clearTimeout(timer); }),
        reset: jest.fn(),
      };
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
