import { listCompletedTrips } from "../api/trip-records.api";
import { useApiQuery } from "@/shared/query/use-resource";
import { safeErrorMessage } from "@/shared/api/trip-us-api";

export function useCompletedTrips() {
  const query = useApiQuery("trips:completed", listCompletedTrips);
  return { trips: query.data ?? [], loading: query.loading,
    error: query.error ? safeErrorMessage(query.error, "여행을 불러오지 못했어요.") : undefined,
    reload: query.refetch };
}
