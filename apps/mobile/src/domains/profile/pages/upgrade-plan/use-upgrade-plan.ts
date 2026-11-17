import { useState } from "react";

import { useApiQuery } from "@/shared/query/use-resource";

import { getEntitlements, upgradePlan } from "@/domains/entitlements/api/entitlements.api";
import { safeErrorMessage } from "@/shared/api/api-error-message";

export function useUpgradePlan() {
  const query = useApiQuery("entitlements", getEntitlements);
  const entitlements = query.data;
  const [error, setError] = useState<string>();
  const loading = query.loading;
  const [upgrading, setUpgrading] = useState(false);

  async function upgrade() {
    setError(undefined);
    setUpgrading(true);
    try {
      await upgradePlan();
    } catch (reason) {
      setError(safeErrorMessage(reason, "Plus 업그레이드를 완료하지 못했어요."));
    } finally {
      setUpgrading(false);
    }
  }

  return { entitlements, error: error ?? (query.error ? safeErrorMessage(query.error, "플랜 정보를 불러오지 못했어요.") : undefined), loading, upgrade, upgrading };
}
