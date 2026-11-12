import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { supabase } from "./supabase";
import { myRole, canManage } from "./process";
import { requiresMfa } from "./workflow";
export function useRole() {
  const { user, demo, loading } = useAuth();
  const query = useQuery({
    queryKey: ["role", user?.id, demo],
    queryFn: myRole,
    enabled: !loading && !!user && !demo,
    refetchInterval: 30000,
    retry: false,
  });
  const assurance = useQuery({
    queryKey: ["assurance", user?.id],
    queryFn: async () => {
      const r = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error) throw r.error;
      return r.data.currentLevel;
    },
    enabled: !!user && !demo && !!supabase,
    retry: false,
  });
  const role = demo ? "cidadao" : query.data || "cidadao",
    needsMfa = requiresMfa(role) && assurance.data !== "aal2";
  return {
    role,
    needsMfa,
    staff: !demo && canManage(role) && !needsMfa,
    pending: !demo && !!user && query.isPending,
    error: query.error,
  };
}
