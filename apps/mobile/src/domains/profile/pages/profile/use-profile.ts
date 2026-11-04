import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getSession, type AuthSession } from "@/shared/auth/session";
import { getEntitlements, type Entitlements } from "@/domains/entitlements/api/entitlements.api";

export function useProfile() {
  const [user, setUser] = useState<AuthSession["user"]>();
  const [entitlements, setEntitlements] = useState<Entitlements>();
  useFocusEffect(useCallback(() => {
    void Promise.all([getSession(), getEntitlements()]).then(([session, nextEntitlements]) => {
      setUser(session?.user);
      setEntitlements(nextEntitlements);
    });
  }, []));
  return { entitlements, user };
}
