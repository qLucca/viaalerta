import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>Esse caminho não foi encontrado.</h1>
      <p>Volte para o início e continue explorando.</p>
      <Link className="button button-primary" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
