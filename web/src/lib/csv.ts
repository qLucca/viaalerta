import { statusLabels, type Status } from "../types/index.ts";
import { problemTypes, type ProblemType } from "./registration.ts";
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (typeof value !== "number" && /^[\s\u200b-\u200d\ufeff]*[=+@-]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function queueCsv(rows: Record<string, unknown>[]) {
  const fields = [
    "id",
    "status",
    "problem_type",
    "immediate_danger",
    "description",
    "latitude",
    "longitude",
    "created_at",
  ];
  const labels = [
    "Registro",
    "Situação",
    "Tipo de problema",
    "Perigo informado",
    "Observação",
    "Latitude",
    "Longitude",
    "Data do registro",
  ];
  return (
    "\ufeff" +
    [
      labels.map(csvCell).join(";"),
      ...rows.map((r) =>
        fields
          .map((f) =>
            csvCell(
              f === "status"
                ? statusLabels[r[f] as Status] || r[f]
                : f === "problem_type"
                  ? problemTypes[r[f] as ProblemType] || r[f]
                  : f === "immediate_danger"
                    ? r[f]
                      ? "Sim"
                      : "Não"
                    : r[f],
            ),
          )
          .join(";"),
      ),
    ].join("\r\n")
  );
}
