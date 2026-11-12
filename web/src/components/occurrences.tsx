"use client";
import Link from "next/link";
import { problemTypes } from "@/lib/registration";
import Image from "next/image";
import { ArrowUpRight, MapPin, ImageOff } from "lucide-react";
import { statusLabels, type Occurrence, type Status } from "@/types";
import { dateLabel } from "@/lib/utils";
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge ${status}`}>
      <span />
      {statusLabels[status]}
    </span>
  );
}
export function RecordCard({ record }: { record: Occurrence }) {
  return (
    <Link className="record-card" href={`/ocorrencias/${record.id}`}>
      <div className="record-image">
        <Image
          fill
          unoptimized
          sizes="(max-width: 700px) 100vw, 33vw"
          src={record.image_url || record.image_path}
          alt="Via registrada"
          loading="lazy"
        />
        {record.cancelled_at ? (
          <span className="status-badge">Cancelado pelo autor</span>
        ) : record.hidden_at ? (
          <span className="status-badge">Oculto para revisão</span>
        ) : (
          <StatusBadge status={record.status} />
        )}
        {record.simulated && <span className="record-demo">SIMULADO</span>}
      </div>
      <div className="record-body">
        <div className="record-meta">
          <span>#{record.id.slice(-6).toUpperCase()}</span>
          <time>{dateLabel(record.created_at)}</time>
        </div>
        <h3>
          {problemTypes[record.problem_type || "buraco"]} informado
          <ArrowUpRight size={17} />
        </h3>
        <div className="record-location">
          <MapPin size={13} />
          Local aproximado
        </div>
      </div>
    </Link>
  );
}
export function Empty({
  title = "Nenhum registro encontrado.",
  description = "Os novos registros aparecerão neste espaço.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <ImageOff size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
