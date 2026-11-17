import { useCallback, useState } from "react";
import type { SelectedBoundaryPoint } from "../components/trip-boundary-search-field";

type Points = { startPoint?: SelectedBoundaryPoint; endPoint?: SelectedBoundaryPoint };

export function useTripBoundaryPoints() {
  const [points, setPoints] = useState<Points>({});
  const changePoint = useCallback((kind: "startPoint" | "endPoint", point: SelectedBoundaryPoint | undefined) => {
    setPoints((current) => {
      if (point && !current.startPoint && !current.endPoint) {
        const opposite = kind === "startPoint" ? "endPoint" : "startPoint";
        // Mirror the place only; each boundary keeps its own optional time.
        return { [kind]: point, [opposite]: { ...point, time: null } };
      }
      return { ...current, [kind]: point };
    });
  }, []);
  const setStartPoint = useCallback((point: SelectedBoundaryPoint | undefined) => changePoint("startPoint", point), [changePoint]);
  const setEndPoint = useCallback((point: SelectedBoundaryPoint | undefined) => changePoint("endPoint", point), [changePoint]);
  return { ...points, setPoints, setStartPoint, setEndPoint };
}
