import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Providers } from "../src/providers";
import { useTheme } from "../src/theme";
function Navigation() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <Providers>
        <Navigation />
      </Providers>
    </SafeAreaProvider>
  );
}
