"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state" role="alert">
      <h1>Não foi possível carregar esta tela.</h1>
      <p className="my-5">Tente novamente para continuar.</p>
      <Button onClick={reset}>Tentar novamente</Button>
      <Link href="/" className="text-link ml-5">
        Voltar ao início
      </Link>
    </main>
  );
}
