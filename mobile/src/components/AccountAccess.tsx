import { useQuery } from "@tanstack/react-query";
import {
  ScrollView,
  Text,
  Pressable,
  Linking,
  Modal,
  View,
  Platform,
} from "react-native";
import { useState } from "react";
import { router, usePathname } from "expo-router";
import { supabase } from "../lib/supabase";
type Status = {
  state: "active" | "suspended" | "banned";
  until: string | null;
  reason: string | null;
};
export function AccountAccess({
  userId,
  demo,
  logout,
  children,
}: {
  userId?: string;
  demo: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [actionError, setActionError] = useState("");
  const [localMode, setLocalMode] = useState(false);
  const pathname = usePathname();
  const query = useQuery({
    queryKey: ["account-access", userId],
    enabled: !!userId && !demo && !!supabase,
    refetchInterval: 30000,
    retry: false,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      const timeout = setTimeout(abort, 10000);
      let result;
      try {
        result = await supabase!
          .rpc("viaalerta_my_account_status")
          .abortSignal(controller.signal);
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      }
      if (result.error?.code === "PGRST202")
        return { state: "active", until: null, reason: null } as Status;
      if (
        result.error ||
        !["active", "suspended", "banned"].includes(result.data?.state)
      )
        throw new Error(
          "Não foi possível conferir sua conta. Tente novamente.",
        );
      return result.data as Status;
    },
  });
  const localAccess =
    Platform.OS !== "web" &&
    localMode &&
    query.isError &&
    !["banned", "suspended"].includes(query.data?.state || "") &&
    ["/rascunhos", "/registrar", "/mapa"].includes(pathname);
  const allowed =
    localAccess ||
    !userId ||
    demo ||
    !supabase ||
    (!query.isError && query.data?.state === "active");
  return (
    <View style={{ flex: 1 }}>
      {localAccess && (
        <Text
          style={{ padding: 10, backgroundColor: "#dceee5", color: "#15382c" }}
        >
          Modo local: guarde rascunhos. Envio, IA e consultas precisam de
          conexão.
        </Text>
      )}
      <View
        style={{ flex: 1 }}
        pointerEvents={allowed ? "auto" : "none"}
        importantForAccessibility={allowed ? "auto" : "no-hide-descendants"}
        accessibilityElementsHidden={!allowed}
        aria-hidden={!allowed}
      >
        {children}
      </View>
      <Modal visible={!allowed} animationType="none" onRequestClose={() => {}}>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#f5f8f6" }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 28,
            gap: 20,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: 25, fontWeight: "700", color: "#15382c" }}
          >
            {query.isPending
              ? "Conferindo sua conta…"
              : query.isError
                ? "Não foi possível conferir o acesso"
                : query.data?.state === "suspended"
                  ? "Conta suspensa"
                  : "Conta banida do ViaAlerta"}
          </Text>
          {query.error && (
            <Text accessibilityRole="alert" style={{ color: "#15382c" }}>
              {query.error.message}
            </Text>
          )}
          {actionError && (
            <Text accessibilityRole="alert" style={{ color: "#15382c" }}>
              {actionError}
            </Text>
          )}
          {query.data?.reason && (
            <Text style={{ color: "#15382c" }}>
              Motivo: {query.data.reason}
            </Text>
          )}
          {query.data?.until && (
            <Text style={{ color: "#15382c" }}>
              Prazo: {new Date(query.data.until).toLocaleString("pt-BR")}
            </Text>
          )}
          {!query.isPending && (
            <>
              {Platform.OS !== "web" &&
                query.isError &&
                !["banned", "suspended"].includes(query.data?.state || "") && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setLocalMode(true);
                      router.replace("/rascunhos");
                    }}
                    style={{ padding: 16, backgroundColor: "#dceee5" }}
                  >
                    <Text style={{ color: "#15382c" }}>
                      Continuar com rascunhos no aparelho
                    </Text>
                  </Pressable>
                )}
              <Pressable
                accessibilityRole="button"
                onPress={() => void query.refetch()}
                style={{ padding: 16, backgroundColor: "#dceee5" }}
              >
                <Text style={{ color: "#15382c" }}>Conferir novamente</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    "mailto:admin.via.alerta@gmail.com",
                  ).catch(() =>
                    setActionError(
                      "Envie sua solicitação para admin.via.alerta@gmail.com pelo aplicativo de e-mail de sua preferência.",
                    ),
                  )
                }
                style={{ padding: 16, backgroundColor: "#dceee5" }}
              >
                <Text style={{ color: "#15382c" }}>
                  Solicitar revisão por e-mail
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void logout().catch(() =>
                    setActionError(
                      "Não foi possível sair. Confira a conexão e tente novamente.",
                    ),
                  )
                }
                style={{ padding: 16, backgroundColor: "#dceee5" }}
              >
                <Text style={{ color: "#15382c" }}>Sair da conta</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}
