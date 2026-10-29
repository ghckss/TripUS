import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getSession, type AuthSession } from "@/shared/auth/session";

export function useProfile() {
  const [user, setUser] = useState<AuthSession["user"]>();
  useFocusEffect(useCallback(() => { void getSession().then((session) => setUser(session?.user)); }, []));
  return user;
}
