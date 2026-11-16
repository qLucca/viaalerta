export const privacySections = [
  [
    "p",
    "Atualizado em 15 de novembro de 2026. Esta página descreve o funcionamento do MVP e as escolhas disponíveis. Ela não representa uma certificação de conformidade com a LGPD.",
  ],
  ["h2", "Quem responde pelo tratamento?"],
  [
    "p",
    "O ViaAlerta é um projeto acadêmico colaborativo para registrar problemas nas vias. Não é um canal oficial da Prefeitura de Uberlândia. O responsável pelo projeto decide como os dados são utilizados; o acesso institucional no sistema não comprova vínculo com um órgão público.",
  ],
  ["h2", "Quais dados são usados e para quê?"],
  [
    "li",
    "Nome, e-mail e dados de autenticação: criar a conta, permitir acesso e proteger as operações.",
  ],
  [
    "li",
    "Foto, descrição e localização confirmada do problema: registrar a ocorrência, analisar a imagem e permitir o acompanhamento.",
  ],
  [
    "li",
    "Histórico e ações de gestão: apresentar o andamento e manter rastreabilidade das alterações.",
  ],
  [
    "li",
    "Denúncias, justificativas e restrições de conta: revisar abusos e proteger a comunidade. A administração consulta nome, e-mail, data de cadastro, último login e contagens de registros e denúncias. A identidade do denunciante e as notas internas ficam restritas à administração. Suspensões e banimentos podem ser contestados pelo contato de privacidade informado nesta página.",
  ],
  [
    "li",
    "Foto de perfil: personalizar sua área da conta, em armazenamento privado.",
  ],
  [
    "li",
    "Número de WhatsApp e preferências: enviar atualizações dos seus registros, somente se você optar pelo canal e quando a integração estiver ativa.",
  ],
  ["h2", "Fotos e localização"],
  [
    "p",
    "Antes de enviar, confira o ponto no mapa e evite rostos, placas, documentos e dados de outras pessoas. A cópia preparada pelo aplicativo é reduzida e redesenhada para remover metadados da imagem. As coordenadas confirmadas são armazenadas separadamente no registro.",
  ],
  [
    "p",
    "Fotos de ocorrências, localização e histórico podem aparecer no mapa e em páginas públicas. Fotos de conclusão também podem ser públicas. Sua foto de perfil e preferências de contato não são publicadas nessas páginas.",
  ],
  ["h2", "Armazenamento e serviços envolvidos"],
  [
    "p",
    "O sistema utiliza Supabase para banco PostgreSQL, autenticação e armazenamento, e Microsoft Azure para hospedar a aplicação e a API de análise de imagens. O mapa utiliza OpenStreetMap, cujo servidor de mapas pode receber o IP do visitante ao carregar os mapas. O processamento pode envolver infraestrutura fora do Brasil, conforme a região e os contratos dos serviços.",
  ],
  [
    "p",
    "Quando ativados, os provedores de e-mail e WhatsApp recebem apenas os dados necessários para entregar a atualização. Não há envio de publicidade neste fluxo. As integrações externas precisam de configuração antes de realizar envios.",
  ],
  ["h2", "Escolhas e consentimento"],
  [
    "p",
    "No perfil, você pode optar separadamente por e-mail e WhatsApp e retirar a autorização depois. Desativar um canal impede novos envios por ele após a atualização; mensagens já entregues não podem ser recolhidas. A confirmação de publicação da foto é solicitada no registro. O uso da conta não significa autorização automática para todos os canais.",
  ],
  ["h2", "Segurança e tempo de conservação"],
  [
    "p",
    "Há controle de acesso por usuário, município e perfil; ações administrativas protegidas exigem duas etapas. Nenhum serviço é isento de riscos. Dados permanecem enquanto necessários à conta e ao acompanhamento, sujeitos às obrigações aplicáveis. O projeto ainda precisa formalizar prazos de retenção e descarte; não há promessa de exclusão automática em um prazo fixo. Backups podem ter ciclos próprios de eliminação.",
  ],
  ["h2", "Seus direitos e como pedir atendimento"],
  [
    "p",
    "Você pode solicitar confirmação de tratamento, acesso, correção, informações de compartilhamento, revogação do consentimento e eliminação quando cabível. Certos dados podem precisar ser conservados nas hipóteses legais. Corrija seu nome, sua foto e as preferências no perfil; para outras solicitações, use o contato do responsável abaixo.",
  ],
  [
    "p",
    "As bases legais de cada finalidade e a identificação formal do controlador devem ser documentadas pelo responsável conforme o contexto de operação. Este MVP não deve ser apresentado como serviço oficial do município.",
  ],
] as const;
