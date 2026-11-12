"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { supabase } from "./supabase/client";
import { requiresMfa } from "./workflow";
import { myRole, canManage } from "./api/process";
export function useRole() {
  const { user, demo, loading } = useAuth();
  const query = useQuery({
    queryKey: ["role", user?.id, demo],
    queryFn: myRole,
    enabled: !loading && !!user && !demo,
    refetchInterval: 30000,
    retry: false,
  });
  const role = demo ? "cidadao" : query.data || "cidadao";
  const assurance = useQuery({
    queryKey: ["assurance", user?.id],
    queryFn: async () => {
      const result = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
      if (result.error) throw result.error;
      return result.data.currentLevel;
    },
    enabled: !!user && !demo && !!supabase,
    retry: false,
  });
  const needsMfa = requiresMfa(role) && assurance.data !== "aal2";
  return {
    role,
    needsMfa,
    staff: !demo && canManage(role) && !needsMfa,
    pending: !demo && !!user && query.isPending,
    error: query.error,
  };
}
