import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const light = {
  bg: "#F4F7F5",
  surface: "#FFFFFF",
  surface2: "#EDF3EF",
  text: "#203B30",
  muted: "#6C8075",
  line: "#E0E9E3",
  green: "#257E5F",
  onGreen: "#FFFFFF",
  soft: "#E3F1E8",
  red: "#B95346",
  orange: "#AF772D",
};
const dark: typeof light = {
  bg: "#101D16",
  surface: "#192B20",
  surface2: "#22382A",
  text: "#EDF5EF",
  muted: "#A0B8A8",
  line: "#304D39",
  green: "#82D3A4",
  onGreen: "#122E1F",
  soft: "#244834",
  red: "#F19C8D",
  orange: "#E5BA76",
};
export type Preference = "light" | "dark" | "system";
const ThemeContext = createContext({
  colors: light,
  isDark: false,
  preference: "system" as Preference,
  setPreference: (_p: Preference) => {},
});
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setValue] = useState<Preference>("system");
  useEffect(() => {
    AsyncStorage.getItem("viaalerta-theme")
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system")
          setValue(value);
      })
      .catch(() => {});
  }, []);
  const isDark =
    preference === "system" ? system === "dark" : preference === "dark";
  function setPreference(value: Preference) {
    setValue(value);
    void AsyncStorage.setItem("viaalerta-theme", value).catch(() => {});
  }
  return (
    <ThemeContext.Provider
      value={{
        colors: isDark ? dark : light,
        isDark,
        preference,
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
