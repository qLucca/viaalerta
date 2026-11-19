# ViaAlerta

**Uma fotografia pode ser o primeiro passo para colocar um problema da cidade no mapa.**

O ViaAlerta é um projeto acadêmico que conecta inteligência artificial e participação
cidadã para identificar e registrar possíveis buracos em vias públicas. A solução
reúne uma aplicação web, um aplicativo Android e uma API de visão computacional,
com autenticação e dados compartilhados na nuvem.

## A ideia e a finalidade

Buracos nas ruas prejudicam a mobilidade, causam danos aos veículos e representam
riscos para pedestres, ciclistas, motociclistas e motoristas. O projeto nasceu da
ideia de facilitar a contribuição de quem encontra esses problemas no dia a dia.

A pessoa envia uma fotografia, confere a análise da IA e confirma o ponto no mapa.
O registro pode ser consultado pela comunidade e acompanhado ao longo do atendimento.
Para equipes autorizadas, o sistema oferece ferramentas para organizar ocorrências,
registrar o andamento e informar uma previsão de intervenção.

A proposta é reunir informações que apoiem a identificação de pontos de risco e o
planejamento da manutenção urbana. **O projeto não representa um canal oficial de
uma prefeitura e não garante atendimento ou reparo.**

## Conheça o projeto

- [Aplicação web](https://viaalerta-web.lemonground-59ee7d93.centralus.azurecontainerapps.io)
- [Download do aplicativo Android — versão 1.0.3](https://github.com/qLucca/viaalerta/releases/tag/android-v1.0.3)
- [Modelo treinado e manifesto SHA-256](https://github.com/qLucca/viaalerta/releases/tag/modelo-buracos-v2-20261116)

O APK é uma versão de demonstração distribuída pelo GitHub, com assinatura de teste.
A disponibilidade dos serviços depende do ambiente de hospedagem.

## Como funciona

1. **Fotografar:** escolher uma imagem da galeria ou tirar uma foto no Android.
2. **Analisar:** enviar a imagem à API, que sinaliza possíveis buracos com o YOLO11s.
3. **Conferir:** confirmar ou corrigir a indicação apresentada pela IA.
4. **Localizar:** escolher o ponto no mapa e conferir as coordenadas e a precisão disponível.
5. **Registrar:** revisar os dados e autorizar o compartilhamento da fotografia.
6. **Acompanhar:** consultar a situação, os comentários e o histórico do registro.

As aplicações web e Android utilizam a mesma API de detecção e o mesmo projeto
Supabase. As fotografias enviadas pelos usuários **não treinam o modelo automaticamente**.

## Funcionalidades

| Área | Recursos |
| --- | --- |
| Participação cidadã | Registro com foto e localização, conferência humana da análise, consulta de ocorrências próximas e apoio a registros existentes. |
| Mapa colaborativo | Pontos agrupados, filtros por situação, tipo, período e autoria, além de lista de registros da área. |
| Acompanhamento | Histórico, comentários, previsão de intervenção e foto de conclusão. Edição e cancelamento de registros próprios antes do atendimento, conforme as regras do fluxo. |
| Atendimento municipal | Perfis com acesso ao município autorizado, atualização de situação, justificativas e registro da conclusão. |
| Administração | Revisão de solicitações de acesso e denúncias, consulta de usuários, suspensão, banimento reversível e auditoria. |
| Conta e segurança | Autenticação, foto privada de perfil, troca de senha e autenticador TOTP com QR Code ou chave manual. MFA exigido para gestores e administradores. |
| Android | Câmera, galeria, localização e rascunhos locais com foto e coordenadas para envio posterior. |
| Privacidade | Página de privacidade e LGPD, autorização de compartilhamento e preferências de comunicação por canal. |

Notificações de andamento estão disponíveis dentro da aplicação. As integrações de
e-mail e WhatsApp exigem provedores, credenciais, consentimento e configuração do
serviço de envio. Salvar uma preferência não ativa, por si só, o envio de mensagens.

## Inteligência artificial e resultados

O detector utiliza **YOLO11s**, da Ultralytics, com PyTorch, para localizar uma classe:
**buraco**. O desenvolvimento envolveu preparação dos dados, treinamento, avaliação
e ajuste fino com uma base filtrada para essa classe.

A comparação abaixo utiliza o mesmo conjunto de teste para os dois modelos:

| Métrica | Modelo anterior | Modelo após ajuste fino |
| --- | ---: | ---: |
| Precisão | 66,03% | **68,12%** |
| Recall | 45,78% | **55,00%** |
| mAP@50 | 50,51% | **61,23%** |
| mAP@50–95 | 23,62% | **29,79%** |

O mAP avalia a qualidade das detecções considerando as caixas e seus níveis de
confiança. Esses resultados pertencem ao conjunto de teste do experimento e não
representam uma garantia de desempenho em qualquer rua ou fotografia.

A versão avaliada é `buracos_finetune_20261116-000652`. O checkpoint publicado tem
SHA-256 `9608d50fa2cf70fb6866e03e674475b72b2aa1db0658bb681d44ce2b3f092f93`.
A API confere o hash configurado antes de carregar o modelo.

Iluminação, sombras, água e diferenças no pavimento ainda podem causar erros.
A IA não determina profundidade ou gravidade física do buraco. Outros tipos de
problema podem ser registrados para avaliação humana, sem detecção automática.

## Tecnologias utilizadas

| Camada | Tecnologias e finalidade |
| --- | --- |
| Aplicação web | Next.js, React, TypeScript e Tailwind CSS para a interface e os fluxos de registro e acompanhamento. |
| Aplicativo Android | React Native, Expo e Expo Router, com acesso à câmera, galeria e localização. |
| Mapas | Leaflet e OpenStreetMap para visualização e seleção dos pontos. |
| API de detecção | Python, FastAPI, Ultralytics YOLO11s, PyTorch e Pillow para autenticação das chamadas e inferência nas imagens. |
| Modelagem | Jupyter Notebook e ferramentas Python para preparação dos dados, treinamento, comparação e visualização das métricas. |
| Banco e autenticação | Supabase Auth, PostgreSQL com políticas de acesso por linha (RLS) e Supabase Storage para arquivos. |
| Infraestrutura | Docker, Azure Container Apps e Azure Container Registry para executar e distribuir os serviços. |
| Automação | GitHub Actions para verificações e implantação, com autenticação OIDC na Azure. |

## Arquitetura

```text
Web (Next.js) ─────────┐
                      ├── API autenticada (FastAPI + YOLO11s)
Android (React Native)┘             │
        │                          └── Resultado da detecção
        └── Supabase
            ├── Auth: contas, sessões e MFA
            ├── PostgreSQL: registros, perfis e acompanhamento
            └── Storage: fotografias
```

A API executa a inferência; o fluxo da aplicação cuida da revisão e da gravação
dos registros. O treinamento é realizado separadamente e a publicação de um novo
modelo é uma etapa explícita, sem substituição automática durante o treinamento.

## Organização do repositório

```text
api/          API de detecção, Dockerfile e testes
web/          Aplicação web, rotas de servidor e testes
mobile/       Aplicativo Android e testes
notebooks/    Pipelines e documentação da modelagem
supabase/     Funções de comunicação e integrações
infra/        Scripts de preparação e implantação
.github/      Workflows de verificação e publicação
docs/         Guias específicos de uso e configuração
```

Datasets, credenciais, pesos locais, resultados de treinamento e APKs gerados não
fazem parte do código versionado. Os scripts SQL de instalação são mantidos
separadamente; clonar o repositório não cria o banco de dados.

## Executar em desenvolvimento

Requisitos: **Node.js 22.18 ou superior**, npm e um projeto Supabase configurado.
Para executar a API localmente, utilize também **Python 3.11** e o modelo treinado.

### Web

Na pasta `web`, instale as dependências com `npm ci`. Se não houver configuração
local, copie `.env.example` para `.env.local` e preencha:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_DETECTION_API_URL`, com o endpoint completo da API, incluindo `/detect`.

Execute `npm run dev` e abra `http://127.0.0.1:3000`.

### Android

Na pasta `mobile`, execute `npm ci`. Configure `.env.local` a partir de
`.env.example`, usando `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `EXPO_PUBLIC_DETECTION_API_URL`.
Execute `npm start` para iniciar o ambiente Expo. O aplicativo exige uma API HTTPS
acessível pelo aparelho; `localhost` no celular não aponta para o computador.

As variáveis públicas são incorporadas ao build. Alterações de configuração do
aplicativo exigem uma nova compilação para chegar ao APK distribuído.

### API

A partir da raiz do projeto, crie o ambiente Python e instale a versão CPU:

```powershell
py -3.11 -m venv .venv
.venv/Scripts/python -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python -m pip install -r api/requirements.txt
```

Baixe o checkpoint da Release do modelo e coloque `best.pt` em `api/models/`.
Crie `api/.env` com `MODEL_PATH`, `EXPECTED_MODEL_SHA256`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` e `CORS_ORIGINS`. Use `DEVICE=cpu` para execução em CPU.
O hash esperado deve corresponder ao manifesto da Release escolhida.

```powershell
.venv/Scripts/python -m uvicorn api.app:app --host 127.0.0.1 --port 8000 --workers 1 --env-file api/.env
```

`GET /health` informa a saúde do serviço. `POST /detect` recebe a imagem no campo
multipart `file` e exige o token de uma sessão Supabase válida. A documentação
interativa fica em `/docs`. São aceitas imagens JPG, PNG e WebP de até 8 MB e 40 MP.
O dataset de treinamento não é necessário para executar a API.

## Validação e limites

Após instalar as dependências, execute `npm test` e `npm run typecheck` nas pastas
`web` e `mobile`. Na web, execute também `npm run lint` e `npm run build`.
Os testes HTTP isolados da API podem ser executados a partir da raiz com
`python api/tests/test_api.py`, usando o ambiente Python da API.

O modo demonstração é identificado como simulação e não envia seus registros à
base real. No Android, o modo offline preserva rascunhos; a análise pela API,
a sincronização e o carregamento de mapas ainda dependem de conexão.

As fotos compartilhadas não recebem anonimização automática de rostos ou placas.
A pessoa deve revisar a imagem e o local antes de publicar. Nunca coloque senhas,
tokens administrativos ou chaves privadas em variáveis públicas do frontend.

## Documentação complementar

- [Android: instalação, recursos e limitações](docs/ANDROID.md)
- [Mapa, localização e rascunhos offline](docs/MAPA_E_OFFLINE.md)
- [Administração e moderação](docs/ADMINISTRACAO.md)
- [Conta, privacidade e comunicações](docs/COMUNICACOES.md)
- [Dados, treinamento e avaliação](notebooks/README.md)

## Equipe

Projeto desenvolvido por **Anderson Lopes do Nascimento, Igor Gabriel,
Lucca Queiroz e Tiago Cruz**, na **UNIUBE**.
