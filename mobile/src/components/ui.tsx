import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
  type RefreshControlProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Route, ArrowUpRight } from "lucide-react-native";
import { router } from "expo-router";
import { useTheme } from "../theme";
import { useAuth } from "../providers";
import { statusLabels, type Status } from "../types";
export function Txt({
  children,
  style,
  muted = false,
  ...props
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  muted?: boolean;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: muted ? colors.muted : colors.text,
          fontSize: 14,
          lineHeight: 21,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  outline = false,
  disabled = false,
  busy = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        {
          minHeight: 49,
          borderRadius: 13,
          backgroundColor: outline ? colors.surface : colors.green,
          borderWidth: 1,
          borderColor: outline ? colors.line : colors.green,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 9,
          paddingHorizontal: 16,
          paddingVertical: 12,
          opacity: disabled || busy ? 0.48 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? colors.green : colors.onGreen} />
      ) : (
        icon
      )}
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: outline ? colors.text : colors.onGreen,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 18,
          padding: 19,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Logo() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
      <View
        style={{
          width: 35,
          height: 35,
          borderRadius: 11,
          backgroundColor: colors.green,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Route color={colors.onGreen} size={23} />
      </View>
      <Txt style={{ fontWeight: "800", fontSize: 26, letterSpacing: -1 }}>
        via
        <Txt style={{ color: colors.green, fontSize: 26, fontWeight: "800" }}>
          alerta.
        </Txt>
      </Txt>
    </View>
  );
}
export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  back = false,
  refreshControl,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  back?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const { colors } = useTheme();
  const { demo } = useAuth();
  const content = (
    <>
      {back && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(tabs)/dashboard")
          }
        >
          <Txt
            style={{ color: colors.green, fontWeight: "600", marginBottom: 15 }}
          >
            ← Voltar
          </Txt>
        </Pressable>
      )}
      {!!title && (
        <View style={{ marginBottom: 22 }}>
          <Txt
            style={{
              fontSize: 9,
              letterSpacing: 1.4,
              color: colors.green,
              fontWeight: "700",
              marginBottom: 9,
            }}
          >
            CUIDAR DA CIDADE, JUNTOS.
          </Txt>
          <Txt
            style={{
              fontSize: 28,
              lineHeight: 34,
              fontWeight: "700",
              letterSpacing: -1,
            }}
          >
            {title}
          </Txt>
          {!!subtitle && (
            <Txt muted style={{ fontSize: 12, lineHeight: 20, marginTop: 7 }}>
              {subtitle}
            </Txt>
          )}
        </View>
      )}
      {demo && (
        <Notice text="Demonstração: registros e análises simulados. Novos registros ficam apenas neste aparelho." />
      )}
      {children}
    </>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 35, gap: 0 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 20 }}>{content}</View>
      )}
    </SafeAreaView>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole={error ? "alert" : "text"}
      style={{
        backgroundColor: error ? colors.surface2 : colors.soft,
        borderRadius: 10,
        padding: 12,
        marginBottom: 17,
        borderLeftWidth: 3,
        borderLeftColor: error ? colors.red : colors.green,
      }}
    >
      <Txt
        style={{
          fontSize: 11,
          lineHeight: 18,
          color: error ? colors.red : colors.green,
        }}
      >
        {text}
      </Txt>
    </View>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 7, marginBottom: 17 }}>
      <Txt style={{ fontSize: 12, fontWeight: "600" }}>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          {
            minHeight: 48,
            padding: 13,
            borderWidth: 1,
            borderColor: error ? colors.red : colors.line,
            borderRadius: 11,
            color: colors.text,
            backgroundColor: colors.surface,
            fontSize: 14,
          },
          props.style,
        ]}
      />
      {!!error && (
        <Txt style={{ color: colors.red, fontSize: 11 }}>{error}</Txt>
      )}
    </View>
  );
}
export function Badge({ status }: { status: Status }) {
  const { colors } = useTheme();
  const color =
    status === "pendente"
      ? colors.red
      : status === "em_analise"
        ? colors.orange
        : colors.green;
  return (
    <View
      style={{
        backgroundColor: colors.surface2,
        borderRadius: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 9,
        paddingVertical: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
      }}
    >
      <View
        style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }}
      />
      <Txt style={{ fontSize: 10, lineHeight: 16, color, fontWeight: "600" }}>
        {statusLabels[status]}
      </Txt>
    </View>
  );
}
export function Section({
  title,
  link,
  onPress,
}: {
  title: string;
  link?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 14,
        marginTop: 23,
      }}
    >
      <Txt
        style={{
          fontSize: 18,
          fontWeight: "700",
          letterSpacing: -0.5,
          flex: 1,
        }}
      >
        {title}
      </Txt>
      {!!link && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{
            flexDirection: "row",
            gap: 3,
            alignItems: "center",
            minHeight: 35,
          }}
        >
          <Txt style={{ fontSize: 11, color: colors.green, fontWeight: "600" }}>
            {link}
          </Txt>
          <ArrowUpRight size={14} color={colors.green} />
        </Pressable>
      )}
    </View>
  );
}
export function Loading() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 120,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator color={colors.green} />
      <Txt muted>Carregando…</Txt>
    </View>
  );
}
export function Empty({
  text = "Nenhum registro encontrado.",
}: {
  text?: string;
}) {
  return (
    <Card>
      <Txt muted style={{ textAlign: "center", paddingVertical: 24 }}>
        {text}
      </Txt>
    </Card>
  );
}
