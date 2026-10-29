import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { getSession } from "@/shared/auth/session";

export default function Index() {
  const [authenticated, setAuthenticated] = useState<boolean>();
  useEffect(() => { void getSession().then((session) => setAuthenticated(Boolean(session))); }, []);
  if (authenticated === undefined) return null;
  return <Redirect href={authenticated ? "/(tabs)/trips" : "/(auth)/login"} />;
}
