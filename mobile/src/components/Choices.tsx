import { View, Pressable } from "react-native";
import { Txt } from "./ui";
import { useTheme } from "../theme";

export function Choices({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt style={{ fontWeight: "700" }}>{label}</Txt>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {Object.entries(options).map(([key, title]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={title}
            accessibilityState={{ checked: value === key, disabled }}
            disabled={disabled}
            onPress={() => onChange(key)}
            style={{
              minHeight: 48,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: value === key ? colors.green : colors.line,
              backgroundColor: value === key ? colors.soft : colors.surface,
            }}
          >
            <Txt>
              {value === key ? "● " : "○ "}
              {title}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
