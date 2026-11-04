"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowRight,
  Camera,
  ScanLine,
  MapPin,
  Check,
  Users,
  ShieldCheck,
  MoveUpRight,
} from "lucide-react";
import { Logo, ThemeSwitch } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers";
export default function Home() {
  const { enterDemo } = useAuth();
  const router = useRouter();
  return (
    <div className="landing">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#como-funciona">Como funciona</a>
          <a href="#inteligencia">Nossa tecnologia</a>
          <Link href="/mapa">
            Mapa colaborativo <ArrowUpRight size={14} />
          </Link>
        </nav>
        <div className="actions">
          <ThemeSwitch />
          <Link className="login-link" href="/login">
            Entrar
          </Link>
          <Button asChild>
            <Link href="/cadastro">
              Fazer parte <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <main id="conteudo">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="status-dot" /> UMA CIDADE MELHOR COMEÇA NO
              CAMINHO
            </div>
            <h1>
              Tecnologia por
              <br />
              ruas <em>mais seguras.</em>
            </h1>
            <p>
              Seu olhar encontra. A inteligência artificial ajuda a identificar.
              Juntos, colocamos os problemas das nossas ruas no mapa.
            </p>
            <div className="hero-buttons">
              <Button asChild>
                <Link href="/cadastro">
                  Começar agora <ArrowUpRight size={19} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/mapa">
                  <MapPin size={18} /> Explorar mapa
                </Link>
              </Button>
            </div>
            <button
              className="demo-link"
              onClick={() => {
                enterDemo();
                router.push("/dashboard");
              }}
            >
              Conheça a demonstração, sem criar uma conta{" "}
              <ArrowRight size={15} />
            </button>
            <div className="hero-trust">
              <div className="trust-avatars">
                <span>LC</span>
                <span>AM</span>
                <span>JB</span>
              </div>
              <span>
                Uma plataforma colaborativa.
                <br />
                <strong>Um caminho melhor para todos.</strong>
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-map-grid">
              <svg viewBox="0 0 600 570" aria-hidden="true">
                <defs>
                  <pattern
                    id="blocks"
                    width="100"
                    height="95"
                    patternTransform="rotate(-25)"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      width="86"
                      height="80"
                      rx="9"
                      fill="currentColor"
                      opacity=".4"
                    />
                    <path
                      d="M0 89H100 M93 0V95"
                      stroke="white"
                      strokeWidth="3"
                      opacity=".7"
                    />
                  </pattern>
                </defs>
                <rect width="600" height="570" fill="url(#blocks)" />
                <path
                  d="M-30 460C150 440 80 210 270 250S400 390 640 20"
                  stroke="#c0dacf"
                  strokeWidth="45"
                  fill="none"
                />
                <path
                  d="M-30 460C150 440 80 210 270 250S400 390 640 20"
                  stroke="#eaf4ee"
                  strokeWidth="24"
                  fill="none"
                  strokeDasharray="8 6"
                />
              </svg>
              <span className="hero-map-label label-one">BELA VISTA</span>
              <span className="hero-map-label label-two">CONSOLAÇÃO</span>
              <span className="hero-pin pin-one">
                <MapPin size={25} />
              </span>
              <span className="hero-pin pin-two">
                <Check size={22} />
              </span>
              <span className="hero-pin pin-three">
                <MapPin size={23} />
              </span>
              <div className="hero-photo">
                <Image
                  width={800}
                  height={500}
                  src="/demo-road.svg"
                  alt="Ilustração de buraco em uma via, com caixa demonstrativa de detecção"
                />
                <span className="photo-box">
                  <small>buraco · 94%</small>
                </span>
                <div>
                  <span className="status-dot" /> IA que ajuda a enxergar{" "}
                  <span>SIMULAÇÃO</span>
                </div>
              </div>
              <div className="hero-mini-card">
                <span className="mini-check">
                  <Check size={19} />
                </span>
                <div>
                  <strong>No mapa. No radar.</strong>
                  <small>Cada registro dá visibilidade ao problema.</small>
                </div>
              </div>
              <div className="map-caption">
                <MapPin size={14} /> Mapa ilustrativo · São Paulo
              </div>
            </div>
          </div>
        </section>
        <section className="mission-strip">
          <span>
            PEQUENAS AÇÕES.
            <br />
            <strong>GRANDES CAMINHOS.</strong>
          </span>
          <div>
            <Camera size={22} />
            <p>
              Registre o que
              <br />
              <strong>você vê.</strong>
            </p>
          </div>
          <div>
            <ScanLine size={22} />
            <p>
              Conte com a<br />
              <strong>inteligência artificial.</strong>
            </p>
          </div>
          <div>
            <Users size={22} />
            <p>
              Contribua com
              <br />
              <strong>toda a comunidade.</strong>
            </p>
          </div>
        </section>
        <section className="how-section" id="como-funciona">
          <div className="section-intro">
            <span className="eyebrow">DO SEU OLHAR PARA O MAPA</span>
            <h2>
              Simples para você.
              <br />
              Importante para a cidade.
            </h2>
            <p>
              Transforme uma foto em informação útil para quem passa pelo mesmo
              caminho.
            </p>
          </div>
          <div className="how-grid">
            {[
              {
                n: "01",
                icon: Camera,
                title: "Fotografe com segurança",
                text: "Encontrou um buraco? Envie uma foto da galeria ou use a câmera do celular.",
              },
              {
                n: "02",
                icon: ScanLine,
                title: "Confira a análise",
                text: "A IA sinaliza possíveis buracos. Você confere o resultado e confirma a localização.",
              },
              {
                n: "03",
                icon: MapPin,
                title: "Coloque no mapa",
                text: "Registre a ocorrência e acompanhe o status em um mapa aberto à comunidade.",
              },
            ].map(({ n, icon: Icon, title, text }) => (
              <article key={n}>
                <div>
                  <span className="how-icon">
                    <Icon size={25} />
                  </span>
                  <span className="how-number">{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="ai-section" id="inteligencia">
          <div className="ai-symbol">
            <ScanLine size={85} strokeWidth={0.9} />
            <span>YOLO11n</span>
            <i />
            <i />
          </div>
          <div>
            <span className="eyebrow">TECNOLOGIA COM PROPÓSITO</span>
            <h2>
              Inteligência artificial.
              <br />
              <em>Confirmação humana.</em>
            </h2>
            <p>
              O ViaAlerta está preparado para conectar o modelo YOLO11n e
              identificar possíveis buracos nas fotografias. A IA apoia seu
              olhar; você confirma o registro e o local.
            </p>
            <div className="ai-disclosure">
              <ShieldCheck size={20} />
              <span>
                Neste MVP, as análises são demonstrativas. A API do modelo será
                integrada em uma próxima etapa.
              </span>
            </div>
            <Link href="/registrar" className="text-link">
              Experimente o fluxo completo <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">NOSSA CIDADE. NOSSO CUIDADO.</span>
          <h2>
            O próximo caminho melhor
            <br />
            pode começar com você.
          </h2>
          <Button asChild>
            <Link href="/cadastro">
              Quero fazer parte <MoveUpRight size={18} />
            </Link>
          </Button>
          <p>Colaborativo por natureza. Seguro por princípio.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Logo />
          <p>Tecnologia por ruas mais seguras.</p>
        </div>
        <div>
          <Link href="/mapa">Explorar mapa</Link>
          <Link href="/login">Minha conta</Link>
          <a href="#como-funciona">Como funciona</a>
        </div>
        <span>
          ViaAlerta © {new Date().getFullYear()}
          <br />
          Projeto acadêmico · MVP demonstrativo
        </span>
      </footer>
    </div>
  );
}
