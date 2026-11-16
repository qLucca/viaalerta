import { Tabs, Redirect } from "expo-router";
import { View } from "react-native";
import {
  Home,
  Map,
  Plus,
  ClipboardList,
  UserRound,
  Bell,
} from "lucide-react-native";
import { useAuth } from "../../src/providers";
import { useTheme } from "../../src/theme";
import { Loading } from "../../src/components/ui";
import { useQuery } from "@tanstack/react-query";
import { notifications } from "../../src/lib/process";
export default function TabLayout() {
  const { user, loading, demo } = useAuth();
  const unread = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: notifications,
    enabled: !!user && !demo && !loading,
    refetchInterval: 15000,
    retry: false,
  });
  const unreadCount = unread.data?.filter((n) => !n.read_at).length || 0;
  const { colors } = useTheme();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 77,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <Home size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: "Mapa",
          tabBarIcon: ({ color }) => <Map size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="registrar"
        options={{
          title: "Registrar",
          tabBarIcon: () => (
            <View
              style={{
                width: 39,
                height: 39,
                borderRadius: 13,
                backgroundColor: colors.green,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 6,
              }}
            >
              <Plus size={25} color={colors.onGreen} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ocorrencias"
        options={{
          title: "Registros",
          tabBarIcon: ({ color }) => <ClipboardList size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: "Avisos",
          tabBarBadge: unreadCount
            ? unreadCount > 99
              ? "99+"
              : unreadCount
            : undefined,
          tabBarIcon: ({ color }) => <Bell size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <UserRound size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}
