import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/shell";
export const metadata: Metadata = {
  title: "Privacidade e LGPD",
  description:
    "Entenda os dados utilizados pelo ViaAlerta e como exercer seus direitos.",
};

export default function Privacy() {
  const contact =
    process.env.PRIVACY_CONTACT_EMAIL || "admin.via.alerta@gmail.com";
  const validContact = contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  return (
    <div className="privacy-page">
      <header>
        <Logo />
        <Link className="text-link" href="/">
          Voltar ao início
        </Link>
      </header>
      <main id="main" className="panel form-section stack">
        <span className="eyebrow">TRANSPARÊNCIA NO VIAALERTA</span>
        <h1>Privacidade e proteção de dados</h1>
        <p>
          Atualizado em 15 de novembro de 2026. Esta página descreve o
          funcionamento do MVP e as escolhas disponíveis. Ela não representa uma
          certificação de conformidade com a LGPD.
        </p>
        <h2>Quem responde pelo tratamento?</h2>
        <p>
          O ViaAlerta é um projeto acadêmico colaborativo para registrar
          problemas nas vias. Não é um canal oficial da Prefeitura de
          Uberlândia. O responsável pelo projeto decide como os dados são
          utilizados; o acesso institucional no sistema não comprova vínculo com
          um órgão público.
        </p>
        <h2>Quais dados são usados e para quê?</h2>
        <ul>
          <li>
            Nome, e-mail e dados de autenticação: criar a conta, permitir acesso
            e proteger as operações.
          </li>
          <li>
            Foto, descrição e localização confirmada do problema: registrar a
            ocorrência, analisar a imagem e permitir o acompanhamento.
          </li>
          <li>
            Histórico e ações de gestão: apresentar o andamento e manter
            rastreabilidade das alterações.
          </li>
          <li>
            Denúncias, justificativas e restrições de conta: revisar abusos e
            proteger a comunidade. A administração consulta nome, e-mail, data
            de cadastro, último login e contagens de registros e denúncias. A
            identidade do denunciante e as notas internas ficam restritas à
            administração. Suspensões e banimentos podem ser contestados pelo
            contato de privacidade informado nesta página.
          </li>
          <li>
            Foto de perfil: personalizar sua área da conta, em armazenamento
            privado.
          </li>
          <li>
            Número de WhatsApp e preferências: enviar atualizações dos seus
            registros, somente se você optar pelo canal e quando a integração
            estiver ativa.
          </li>
        </ul>
        <h2>Fotos e localização</h2>
        <p>
          Antes de enviar, confira o ponto no mapa e evite rostos, placas,
          documentos e dados de outras pessoas. A cópia preparada pelo
          aplicativo é reduzida e redesenhada para remover metadados da imagem.
          As coordenadas confirmadas são armazenadas separadamente no registro.
        </p>
        <p>
          Fotos de ocorrências, localização e histórico podem aparecer no mapa e
          em páginas públicas. Fotos de conclusão também podem ser públicas. Sua
          foto de perfil e preferências de contato não são publicadas nessas
          páginas.
        </p>
        <h2>Armazenamento e serviços envolvidos</h2>
        <p>
          O sistema utiliza Supabase para banco PostgreSQL, autenticação e
          armazenamento, e Microsoft Azure para hospedar a aplicação e a API de
          análise de imagens. O mapa utiliza OpenStreetMap, cujo servidor de
          mapas pode receber o IP do visitante ao carregar os mapas. O
          processamento pode envolver infraestrutura fora do Brasil, conforme a
          região e os contratos dos serviços.
        </p>
        <p>
          Quando ativados, os provedores de e-mail e WhatsApp recebem apenas os
          dados necessários para entregar a atualização. Não há envio de
          publicidade neste fluxo. As integrações externas precisam de
          configuração antes de realizar envios.
        </p>
        <h2>Escolhas e consentimento</h2>
        <p>
          No{" "}
          <Link className="text-link" href="/perfil">
            perfil
          </Link>
          , você pode optar separadamente por e-mail e WhatsApp e retirar a
          autorização depois. Desativar um canal impede novos envios por ele
          após a atualização; mensagens já entregues não podem ser recolhidas. A
          confirmação de publicação da foto é solicitada no registro. O uso da
          conta não significa autorização automática para todos os canais.
        </p>
        <h2>Segurança e tempo de conservação</h2>
        <p>
          Há controle de acesso por usuário, município e perfil; ações
          administrativas protegidas exigem duas etapas. Nenhum serviço é isento
          de riscos. Dados permanecem enquanto necessários à conta e ao
          acompanhamento, sujeitos às obrigações aplicáveis. O projeto ainda
          precisa formalizar prazos de retenção e descarte; não há promessa de
          exclusão automática em um prazo fixo. Backups podem ter ciclos
          próprios de eliminação.
        </p>
        <h2>Seus direitos e como pedir atendimento</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção,
          informações de compartilhamento, revogação do consentimento e
          eliminação quando cabível. Certos dados podem precisar ser conservados
          nas hipóteses legais. Corrija seu nome, sua foto e as preferências no
          perfil; para outras solicitações, use o contato do responsável abaixo.
        </p>
        {validContact ? (
          <p>
            Contato para privacidade:{" "}
            <a className="text-link" href={`mailto:${contact}`}>
              {contact}
            </a>
            . Informe o pedido e o e-mail da conta, sem enviar senha ou códigos
            do autenticador.
          </p>
        ) : (
          <div className="info-box">
            O contato de privacidade ainda não foi publicado pelo responsável.
            Este canal e os prazos de atendimento precisam ser definidos antes
            de ampliar a disponibilização pública do projeto.
          </div>
        )}
        <p>
          As bases legais de cada finalidade e a identificação formal do
          controlador devem ser documentadas pelo responsável conforme o
          contexto de operação. Este MVP não deve ser apresentado como serviço
          oficial do município.
        </p>
        <h2>Saiba mais</h2>
        <p>
          <a
            className="text-link"
            href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares"
            target="_blank"
            rel="noreferrer"
          >
            Direitos dos titulares na ANPD
          </a>{" "}
          ·{" "}
          <a
            className="text-link"
            href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
            target="_blank"
            rel="noreferrer"
          >
            Lei Geral de Proteção de Dados (Lei 13.709/2018)
          </a>
        </p>
      </main>
    </div>
  );
}
