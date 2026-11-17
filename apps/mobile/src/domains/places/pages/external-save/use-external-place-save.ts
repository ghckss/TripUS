import { listTrips } from "@/domains/trips/api/trips.api";
import { useApiQuery } from "@/shared/query/use-resource";
import { safeErrorMessage } from "@/shared/api/trip-us-api";

export function useExternalPlaceSave() {
  const query = useApiQuery("trips:list", listTrips);
  return { trips: query.data ?? [], loading: query.loading,
    error: query.error ? safeErrorMessage(query.error, "여행을 불러오지 못했어요.") : undefined,
    reload: query.refetch };
}
