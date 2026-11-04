import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, Monitor, LogOut } from "lucide-react-native";
import {
  Screen,
  Txt,
  Card,
  Field,
  Button,
  Notice,
  Section,
} from "../../src/components/ui";
import { useAuth } from "../../src/providers";
import { useTheme } from "../../src/theme";
import { countOccurrences } from "../../src/lib/occurrences";
export default function Profile() {
  const { user, demo, rename, logout } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);
  const { data = 0 } = useQuery({
    queryKey: ["profile-count", demo, user?.id],
    queryFn: () => countOccurrences(demo, { mine: true }),
    enabled: !!user,
  });
  async function save() {
    setError("");
    setMessage("");
    if (name.trim().length < 2 || name.trim().length > 80) {
      setError("Informe um nome entre 2 e 80 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await rename(name.trim());
      setMessage("Seu perfil foi atualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exit() {
    setError("");
    try {
      await logout();
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Screen title="Meu perfil" subtitle="Seu espaço. Suas contribuições.">
      <Card>
        <View
          style={{
            flexDirection: "row",
            gap: 15,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <View
            style={{
              width: 59,
              height: 59,
              borderRadius: 30,
              backgroundColor: colors.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt
              style={{ fontSize: 25, fontWeight: "700", color: colors.green }}
            >
              {user?.name[0]?.toUpperCase()}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: "700", fontSize: 19 }}>{user?.name}</Txt>
            <Txt muted style={{ fontSize: 11, marginTop: 4 }}>
              {demo ? "Conta demonstrativa" : "Colaborador ViaAlerta"}
            </Txt>
          </View>
        </View>
        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoComplete="name"
        />
        <Field label="E-mail" value={user?.email || ""} editable={false} />
        {!!error && <Notice text={error} error />}
        {!!message && <Notice text={message} />}
        <Button title="Salvar alterações" busy={busy} onPress={save} />
      </Card>
      <Section title="Do seu jeito" />
      <Card>
        <Txt style={{ fontWeight: "600", marginBottom: 5 }}>Aparência</Txt>
        <Txt muted style={{ fontSize: 11, marginBottom: 17 }}>
          Escolha o tema ou acompanhe o sistema.
        </Txt>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(
            [
              { value: "light", label: "Claro", icon: Sun },
              { value: "dark", label: "Escuro", icon: Moon },
              { value: "system", label: "Sistema", icon: Monitor },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: preference === value }}
              onPress={() => setPreference(value)}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: preference === value ? colors.green : colors.line,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                gap: 7,
                backgroundColor:
                  preference === value ? colors.soft : colors.surface,
              }}
            >
              <Icon
                size={19}
                color={preference === value ? colors.green : colors.muted}
              />
              <Txt
                style={{
                  fontSize: 10,
                  color: preference === value ? colors.green : colors.muted,
                }}
              >
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Txt style={{ fontSize: 22, fontWeight: "700", color: colors.green }}>
          {data}
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          contribuições{demo ? " de demonstração" : ""}
        </Txt>
        <Txt muted style={{ fontSize: 11, lineHeight: 19, marginTop: 14 }}>
          Web e Android compartilham os registros reais. Demonstrações ficam
          apenas neste dispositivo.
        </Txt>
      </Card>
      <Button
        title="Encerrar sessão"
        outline
        onPress={exit}
        icon={<LogOut size={16} color={colors.green} />}
        style={{ marginTop: 22 }}
      />
      <Txt muted style={{ fontSize: 9, textAlign: "center", marginTop: 22 }}>
        ViaAlerta Android · 1.0.0
      </Txt>
    </Screen>
  );
}
