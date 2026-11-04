import { useState } from "react";
import { View, Pressable, Switch } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ImagePlus,
  ScanLine,
  LocateFixed,
  Check,
  ArrowRight,
} from "lucide-react-native";
import {
  Screen,
  Card,
  Txt,
  Button,
  Field,
  Notice,
  Section,
} from "../../src/components/ui";
import { DetectionImage } from "../../src/components/DetectionImage";
import { useAuth } from "../../src/providers";
import { useTheme } from "../../src/theme";
import { pickPhoto, examplePhoto } from "../../src/lib/photos";
import { analyzePhoto, mockDetection } from "../../src/lib/detection";
import { currentPoint } from "../../src/lib/location";
import { saveOccurrence } from "../../src/lib/occurrences";
import Map from "../../src/map/Map";
import type { Analysis, Photo, Point } from "../../src/types";
export default function Register() {
  const { demo } = useAuth();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<Photo>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [point, setPoint] = useState<Point>([-23.552, -46.65]);
  const [latitude, setLatitude] = useState("-23.552");
  const [longitude, setLongitude] = useState("-46.650");
  const [chosen, setChosen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const simulated = demo || mockDetection;
  async function choose(source: "camera" | "gallery" | "example") {
    setBusy(true);
    setError("");
    try {
      const selected =
        source === "example"
          ? await examplePhoto()
          : await pickPhoto(source === "camera");
      if (selected) {
        setPhoto(selected);
        setAnalysis(undefined);
        setChosen(false);
        setConfirmed(false);
        setConsent(false);
        setStep(1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    if (!photo) return;
    setBusy(true);
    setError("");
    try {
      setAnalysis(await analyzePhoto(photo, demo, empty));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changePoint(next: Point) {
    setPoint(next);
    setLatitude(String(next[0]));
    setLongitude(String(next[1]));
    setChosen(true);
    setConfirmed(false);
  }
  async function locate() {
    setBusy(true);
    setError("");
    try {
      changePoint(await currentPoint());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function applyCoordinates() {
    const lat = Number(latitude.trim().replace(",", "."));
    const lon = Number(longitude.trim().replace(",", "."));
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      setError("Informe latitude entre -90 e 90 e longitude entre -180 e 180.");
      return;
    }
    setError("");
    changePoint([lat, lon]);
  }
  async function save() {
    if (!photo || !analysis || !chosen || !confirmed || !consent) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveOccurrence(
        photo,
        analysis,
        point,
        notes.trim(),
        demo,
      );
      await cache.invalidateQueries();
      setStep(0);
      setPhoto(undefined);
      setAnalysis(undefined);
      setConsent(false);
      setConfirmed(false);
      setChosen(false);
      setNotes("");
      router.push({
        pathname: "/ocorrencia/[id]",
        params: { id: result.id, local: result.local ? "1" : "0" },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Registrar buraco"
      subtitle="Uma foto pode ser o começo de um caminho melhor."
    >
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 25 }}>
        {["Foto", "Análise", "Local", "Revisão"].map((label, i) => (
          <View key={label} style={{ flex: 1, alignItems: "center", gap: 7 }}>
            <View
              style={{
                height: 29,
                width: 29,
                borderRadius: 15,
                backgroundColor: step >= i ? colors.green : colors.surface2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: step >= i ? colors.onGreen : colors.muted,
                }}
              >
                {i + 1}
              </Txt>
            </View>
            <Txt
              style={{
                fontSize: 10,
                color: step === i ? colors.green : colors.muted,
                fontWeight: step === i ? "700" : "400",
              }}
            >
              {label}
            </Txt>
          </View>
        ))}
      </View>
      {!!error && <Notice text={error} error />}
      {step === 0 && (
        <>
          <Card
            style={{
              padding: 23,
              backgroundColor: colors.soft,
              borderWidth: 0,
            }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 15,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 19,
              }}
            >
              <Camera size={26} color={colors.green} />
            </View>
            <Txt
              style={{
                fontSize: 24,
                lineHeight: 29,
                fontWeight: "700",
                letterSpacing: -0.7,
              }}
            >
              Um retrato do problema.
            </Txt>
            <Txt
              muted
              style={{
                fontSize: 12,
                lineHeight: 21,
                marginTop: 12,
                marginBottom: 23,
              }}
            >
              Mostre o buraco e a via ao redor. Fotografe apenas quando estiver
              em segurança.
            </Txt>
            <Button
              title="Tirar uma foto"
              busy={busy}
              onPress={() => choose("camera")}
              icon={<Camera size={18} color={colors.onGreen} />}
            />
            <Button
              title="Escolher da galeria"
              disabled={busy}
              outline
              onPress={() => choose("gallery")}
              icon={<ImagePlus size={18} color={colors.green} />}
              style={{ marginTop: 12 }}
            />
          </Card>
          <Txt
            muted
            style={{
              fontSize: 10,
              textAlign: "center",
              lineHeight: 18,
              marginTop: 20,
            }}
          >
            JPG, PNG ou formatos aceitos pelo aparelho. A foto é preparada em
            JPEG com até 8 MB antes do envio.
          </Txt>
          {simulated && (
            <Button
              title="Usar foto ilustrativa de exemplo"
              outline
              onPress={() => choose("example")}
              disabled={busy}
              style={{ marginTop: 20 }}
            />
          )}
        </>
      )}
      {step === 1 && photo && (
        <>
          <DetectionImage
            uri={photo.uri}
            width={photo.width}
            height={photo.height}
            analysis={analysis}
          />
          <Section title="Confira a análise" />
          {simulated && (
            <Notice text="Demonstração: a caixa e a confiança são simuladas, não são previsões do YOLO." />
          )}
          {simulated && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Txt muted style={{ fontSize: 11 }}>
                Simular imagem sem buracos
              </Txt>
              <Switch
                accessibilityLabel="Simular imagem sem buracos"
                value={empty}
                disabled={busy}
                onValueChange={(v) => {
                  setEmpty(v);
                  setAnalysis(undefined);
                }}
                trackColor={{ true: colors.green, false: colors.line }}
              />
            </View>
          )}
          <Button
            title="Analisar imagem"
            busy={busy}
            onPress={analyze}
            icon={<ScanLine size={18} color={colors.onGreen} />}
          />
          {analysis && (
            <Card style={{ marginTop: 17 }}>
              <Txt style={{ fontSize: 17, fontWeight: "700" }}>
                {analysis.detections.length
                  ? `${analysis.detections.length} possível buraco identificado`
                  : "Nenhum buraco identificado"}
              </Txt>
              <Txt muted style={{ fontSize: 12, lineHeight: 20, marginTop: 9 }}>
                {analysis.detections.length
                  ? `Maior confiança: ${Math.round(Math.max(...analysis.detections.map((d) => d.confidence)) * 100)}%. Confira a imagem antes de continuar.`
                  : "Você pode registrar o problema mesmo assim, após conferir a foto."}
              </Txt>
            </Card>
          )}
          <Button
            title="Continuar para localização"
            onPress={() => {
              setError("");
              setStep(2);
            }}
            disabled={!analysis || busy}
            icon={<ArrowRight size={17} color={colors.onGreen} />}
            style={{ marginTop: 20 }}
          />
          <Button
            title="Escolher outra foto"
            outline
            disabled={busy}
            onPress={() => {
              setError("");
              setStep(0);
            }}
            style={{ marginTop: 11 }}
          />
        </>
      )}
      {step === 2 && (
        <>
          <Txt
            style={{
              fontSize: 22,
              fontWeight: "700",
              lineHeight: 28,
              marginBottom: 13,
            }}
          >
            Onde a foto foi tirada?
          </Txt>
          <Notice text="O ponto inicial em São Paulo é só referência. Sua localização atual pode ser diferente do local de uma foto da galeria." />
          <Button
            title="Usar minha localização atual"
            busy={busy}
            outline
            onPress={locate}
            icon={<LocateFixed size={17} color={colors.green} />}
          />
          <View style={{ height: 310, marginTop: 18, marginBottom: 14 }}>
            <Map point={point} picking onPoint={changePoint} />
          </View>
          <Txt muted style={{ fontSize: 10, lineHeight: 18, marginBottom: 18 }}>
            Toque no local ou arraste o marcador. Você também pode informar as
            coordenadas abaixo.
          </Txt>
          <View style={{ flexDirection: "row", gap: 11 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Latitude"
                value={latitude}
                keyboardType="numbers-and-punctuation"
                onChangeText={(v) => {
                  setLatitude(v);
                  setConfirmed(false);
                  setChosen(false);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Longitude"
                value={longitude}
                keyboardType="numbers-and-punctuation"
                onChangeText={(v) => {
                  setLongitude(v);
                  setConfirmed(false);
                  setChosen(false);
                }}
              />
            </View>
          </View>
          <Button
            title="Aplicar coordenadas"
            outline
            onPress={applyCoordinates}
            disabled={busy}
          />
          <Button
            title="Confirmar local da fotografia"
            disabled={!chosen || busy}
            onPress={() => {
              setConfirmed(true);
              setError("");
              setStep(3);
            }}
            icon={<Check size={18} color={colors.onGreen} />}
            style={{ marginTop: 15 }}
          />
          <Button
            title="Voltar para análise"
            outline
            disabled={busy}
            onPress={() => setStep(1)}
            style={{ marginTop: 11 }}
          />
        </>
      )}
      {step === 3 && photo && analysis && (
        <>
          <DetectionImage
            uri={photo.uri}
            width={photo.width}
            height={photo.height}
            analysis={analysis}
          />
          <Section title="Tudo certo com seu registro?" />
          <Card style={{ gap: 13, marginBottom: 22 }}>
            <View>
              <Txt muted style={{ fontSize: 10 }}>
                RESULTADO {analysis.simulated ? "SIMULADO" : "DA IA"}
              </Txt>
              <Txt style={{ fontSize: 13, fontWeight: "600", marginTop: 4 }}>
                {analysis.detections.length} detecção ·{" "}
                {Math.round(
                  Math.max(0, ...analysis.detections.map((d) => d.confidence)) *
                    100,
                )}
                % de confiança máxima
              </Txt>
            </View>
            <View>
              <Txt muted style={{ fontSize: 10 }}>
                LOCAL CONFIRMADO
              </Txt>
              <Txt style={{ fontSize: 13, fontWeight: "600", marginTop: 4 }}>
                {point[0].toFixed(5)}, {point[1].toFixed(5)}
              </Txt>
            </View>
            <Txt muted style={{ fontSize: 10 }}>
              A data será registrada no envio.
            </Txt>
          </Card>
          <Field
            label="Observações (opcional)"
            value={notes}
            onChangeText={setNotes}
            maxLength={1000}
            multiline
            numberOfLines={4}
            placeholder="Um ponto de referência pode ajudar…"
            style={{ minHeight: 95, textAlignVertical: "top" }}
          />
          <Txt muted style={{ fontSize: 10, lineHeight: 18, marginBottom: 20 }}>
            Evite rostos, placas ou informações pessoais. Não há anonimização
            automática de imagens.
          </Txt>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            aria-checked={consent}
            accessibilityLabel="Autorizo compartilhar a foto, o ponto e as observações"
            onPress={() => setConsent(!consent)}
            disabled={busy}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 23,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderWidth: 1,
                borderColor: consent ? colors.green : colors.muted,
                borderRadius: 6,
                backgroundColor: consent ? colors.green : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {consent && <Check size={16} color={colors.onGreen} />}
            </View>
            <Txt muted style={{ flex: 1, fontSize: 11, lineHeight: 19 }}>
              Confirmo o local e autorizo compartilhar publicamente a foto, o
              ponto e as observações desta ocorrência.
            </Txt>
          </Pressable>
          {analysis.simulated && (
            <Notice text="Esta análise é simulada: o registro ficará apenas neste aparelho e não será enviado ao Supabase." />
          )}
          <Button
            title="Registrar ocorrência"
            busy={busy}
            disabled={!consent || !confirmed}
            onPress={save}
            icon={<ArrowRight size={17} color={colors.onGreen} />}
          />
          <Button
            title="Rever a localização"
            outline
            disabled={busy}
            onPress={() => setStep(2)}
            style={{ marginTop: 11 }}
          />
        </>
      )}
    </Screen>
  );
}
