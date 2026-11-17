import { useEffect, useState } from "react";
import { useApiQuery } from "@/shared/query/use-resource";

import { getSession, type AuthSession } from "@/shared/auth/session";
import { getEntitlements } from "@/domains/entitlements/api/entitlements.api";

export function useProfile() {
  const [user, setUser] = useState<AuthSession["user"]>();
  const query = useApiQuery("entitlements", getEntitlements);
  useEffect(() => { void getSession().then((session) => setUser(session?.user)); }, []);
  return { entitlements: query.data, loading: query.loading, user };
}
