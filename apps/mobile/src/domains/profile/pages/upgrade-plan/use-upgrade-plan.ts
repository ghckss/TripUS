import { useEffect, useState } from "react";

import { getEntitlements, type Entitlements, upgradePlan } from "@/domains/entitlements/api/entitlements.api";
import { safeErrorMessage } from "@/shared/api/api-error-message";

export function useUpgradePlan() {
  const [entitlements, setEntitlements] = useState<Entitlements>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    void getEntitlements()
      .then(setEntitlements)
      .catch((reason: unknown) => setError(safeErrorMessage(reason, "플랜 정보를 불러오지 못했어요.")))
      .finally(() => setLoading(false));
  }, []);

  async function upgrade() {
    setError(undefined);
    setUpgrading(true);
    try {
      setEntitlements(await upgradePlan());
    } catch (reason) {
      setError(safeErrorMessage(reason, "Plus 업그레이드를 완료하지 못했어요."));
    } finally {
      setUpgrading(false);
    }
  }

  return { entitlements, error, loading, upgrade, upgrading };
}
