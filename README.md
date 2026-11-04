# ViaAlerta

O ViaAlerta é um sistema para registrar buracos em vias públicas por fotografia e
localização. Ele reúne uma aplicação web, um aplicativo Android e uma API de
visão computacional. O objetivo é facilitar o registro e a consulta de ocorrências
em um mapa colaborativo.

O modelo identifica possíveis buracos; o usuário confirma o local e autoriza o
compartilhamento da fotografia antes de salvar a ocorrência. O sistema não possui
integração com prefeituras nem garante que uma ocorrência resulte em reparo.

## Como funciona

1. O usuário entra com sua conta Supabase.
2. Escolhe ou fotografa uma imagem na web ou no Android.
3. O cliente envia a fotografia e o token de sessão à API.
4. A API executa o YOLO11s já treinado e retorna as detecções.
5. O usuário confirma a localização, revisa os dados e autoriza o compartilhamento.
6. A foto e a ocorrência são salvas no Supabase e podem ser consultadas nas duas plataformas.

As fotos recebidas não treinam o modelo automaticamente. O dataset de treinamento
permanece local, separado das fotos e ocorrências dos usuários.

## Tecnologias

| Componente     | Tecnologias                                                                           |
| -------------- | ------------------------------------------------------------------------------------- |
| Web            | Next.js 16, React 19, TypeScript, Tailwind CSS, Leaflet                               |
| Android        | React Native, Expo SDK 57, Expo Router, câmera e localização                          |
| API            | Python 3.11, FastAPI, Ultralytics YOLO11s, PyTorch, Pillow                            |
| Dados e contas | Supabase Auth, PostgreSQL com RLS e Supabase Storage                                  |
| Publicação     | Azure Container Apps, Azure Container Registry, Dockerfiles e GitHub Actions com OIDC |

## Estrutura

```text
api/          Serviço autenticado de inferência e testes HTTP
web/          Interface web e testes do cliente de detecção
mobile/       Aplicativo Android e testes de contrato, mapa e sessão
notebooks/    Notebook, dataset local, pesos e resultados de avaliação
infra/        Scripts de preparação e implantação Azure
.github/      Workflows de publicação
distribuicao/ APK de teste preservado, fora do Git
```

## Executar a web

Requisitos: Node.js 22.18 ou superior e npm.

```powershell
cd web
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Configure `.env.local` antes de iniciar. Se o arquivo já existe, preserve os valores.
Abra `http://127.0.0.1:3000`.

| Variável                               | Finalidade                                   |
| -------------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL do projeto Supabase                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto                     |
| `NEXT_PUBLIC_DETECTION_API_URL`        | Endpoint completo, como `https://API/detect` |

`npm run build` e `npm run build:next` compilam o Next.js com Webpack e saída standalone.
As variáveis `NEXT_PUBLIC_*` são incorporadas ao build; alterá-las exige recompilar.

## Executar a API

A API canônica é `api/app.py`. Ela carrega o `best.pt` uma vez e faz somente
inferência, com aquecimento inicial. CUDA é usada quando disponível; a configuração
`DEVICE=cpu` permite executar ou medir a API em CPU.

Para uma instalação nova em CPU, execute na raiz:

```powershell
py -3.11 -m venv .venv
.venv/Scripts/python -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python -m pip install -r api/requirements.txt
```

O checkpoint não acompanha o Git. Baixe `best.pt` e `SHA256SUMS.txt` da Release
privada `modelo-v1` e coloque-os em `api/models/`. O dataset não é necessário para
executar a API. A inicialização recusa um modelo diferente de `EXPECTED_MODEL_SHA256`.

Crie o arquivo local `api/.env` com as variáveis descritas abaixo e inicie:

```powershell
.venv/Scripts/python -m uvicorn api.app:app --host 127.0.0.1 --port 8000 --workers 1 --env-file api/.env
```

A configuração local da API fica somente em `api/.env`. O notebook não gera nem
sobrescreve o serviço. Execute o comando a partir da raiz do projeto.

| Variável                   | Finalidade                                              |
| -------------------------- | ------------------------------------------------------- |
| `MODEL_PATH`               | Caminho para o checkpoint existente                     |
| `EXPECTED_MODEL_SHA256` | SHA-256 do checkpoint da Release |
| `SUPABASE_URL`             | URL HTTPS do Supabase                                   |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública usada para confirmar a sessão             |
| `CORS_ORIGINS`             | Origens web permitidas, separadas por vírgula           |
| `CONFIANCA`                | Confiança mínima, padrão `0.25`                         |
| `DEVICE`                   | Opcional: `cpu` ou `0`; vazio seleciona automaticamente |
| `CPU_THREADS`              | Threads de inferência em CPU, padrão `1`                |

Caminhos relativos de `MODEL_PATH` consideram a raiz do projeto nos comandos
documentados. Web e Android mantêm suas próprias configurações em `.env.local`.

`GET /health` informa saúde, dispositivo e hash do checkpoint. `POST /detect`
exige `Authorization: Bearer <access_token>` de uma sessão Supabase válida e recebe
upload multipart no campo `file`. A documentação interativa fica em `/docs`.

```json
{
  "detections": [
    {
      "class_id": 0,
      "class_name": "buraco",
      "confidence": 0.94,
      "bbox": [120, 85, 280, 230]
    }
  ],
  "image_width": 640,
  "image_height": 480
}
```

O JSON é um exemplo de contrato. As caixas XYXY usam pixels da imagem orientada
por EXIF. Sem detecções, a lista é vazia. A API aceita JPG, PNG e WebP de até 8 MB
e 40 MP; limita o corpo HTTP, inclusive em streaming. Há uma inferência por vez
e limite de dez tentativas autenticadas por usuário/minuto em memória por processo.
Ela não salva fotografias nem ocorrências no Supabase.

## Executar o Android em desenvolvimento

```powershell
cd mobile
npm ci
Copy-Item .env.example .env.local
npm start
```

Use um aparelho com Expo Go compatível com o SDK ou um ambiente de desenvolvimento
Android. `npm start` inicia o Expo pela rede local. Computador e aparelho precisam
conseguir se comunicar pela rede.

Configure `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
`EXPO_PUBLIC_DETECTION_API_URL`. A API do Android exige HTTPS. As variáveis públicas
entram no binário; o APK existente não recebe alterações de URL automaticamente.

O APK em `distribuicao/ViaAlerta-Android-1.0.0.apk` é uma versão anterior com assinatura
de teste. O próximo APK deve ser gerado somente depois de validar a URL definitiva
da API e autorizar essa etapa. Não é necessário gerar APK para revisar o código.

## Supabase e modo demonstração

Web e Android compartilham autenticação, ocorrências e armazenamento no Supabase.
O esquema existente já foi instalado; não é necessário recriar o banco para publicar.
Os scripts SQL de instalação e diagnóstico são mantidos somente na cópia local.

Use somente a chave pública nos clientes. Nunca coloque `service_role`, senhas ou
chaves privadas em variáveis `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`.
No Supabase Auth, permita os redirecionamentos web e os links Android
`viaalerta://login` e `viaalerta://redefinir-senha` conforme o ambiente utilizado.

Com endpoint vazio ou no modo demonstração, a análise é explicitamente simulada
e os novos registros ficam locais. Resultados simulados não são enviados à base real.
O fluxo real exige sessão, previsão real, confirmação do local e consentimento.
As fotografias compartilhadas não recebem anonimização automática de rostos ou placas.

## Modelo e dados

Checkpoint atual:

```text
notebooks/treinamentos/buracos_aug_nativo_01/yolo_300ep-3/weights/best.pt
```

SHA-256: `842e84e869f3ffbd00945c31f3e6f5736c9f6e79743ae0e5f9d0e1d6cdafdb26`.

O treinamento YOLO11s terminou após 77 épocas por early stopping; a melhor época
informada pelo log foi a 57. Os detalhes, as fontes do dataset e os limites da
avaliação estão em [notebooks/README.md](notebooks/README.md).

| Divisão   |  mAP50 | mAP50–95 | Precisão | Recall |
| --------- | -----: | -------: | -------: | -----: |
| Validação | 0,5326 |   0,2319 |   0,6580 | 0,4620 |
| Teste     | 0,5243 |   0,2285 |   0,6518 | 0,4732 |

Essas métricas são do arquivo de avaliação atual. A acurácia de presença por imagem
não mede a qualidade da localização das caixas.

## Verificação

Instale as dependências de `web` e `mobile` antes dos testes: a web também verifica
a equivalência do contrato com o aplicativo. Em cada pasta, execute `npm test` e `npm run typecheck`.
Na web, execute também `npm run lint` e `npm run build`.
Para os testes HTTP isolados, use o ambiente Python da API, a partir da raiz:

```powershell
python api/tests/test_api.py
```

Os testes HTTP substituem modelo e autenticação. Para testar o checkpoint real
no ambiente de inferência, sem gravar ocorrências:

```powershell
python api/tests/validate_model.py --device cpu --offline-auth --output work/model-cpu.json
```

Nesse comando, apenas a autenticação das análises é substituída. Token ausente e
inválido são rejeitados contra o Supabase configurado. Para testar sessão válida,
informe `VIAALERTA_TEST_ACCESS_TOKEN` no ambiente e retire `--offline-auth`.
Não salve o token no repositório.

Os testes locais anteriores mediram mediana de 43 ms em CPU e pico de memória de
aproximadamente 838 MiB em seis amostras do teste. Isso não prevê a latência na Azure.
Containers Linux, sessão válida, fluxo real completo e aparelho Android ainda
precisam de validação no ambiente final.

As verificações automáticas incluem lint, tipos e testes de contrato web/Android.
Os workflows de publicação dependem dessas verificações. No deploy da API, também
são conferidos o hash do checkpoint e a rejeição de chamadas sem sessão ou com token inválido.
A validação com sessão real e o fluxo completo continuam necessários na Azure.

## Publicação e arquivos locais

O destino é Azure Container Apps, com um serviço para web e outro para API.
A URL pública da API ainda precisa ser validada. O guia de publicação Azure é
mantido somente na cópia local do projeto.

O `.gitignore` mantém credenciais, dependências, datasets, pesos, resultados locais,
caches e APKs fora do Git comum. O `.git` e as alterações locais existentes são
preservados. Antes de publicar, revise explicitamente os arquivos selecionados
com `git status` e `git diff --cached`; não envie todo o diretório indiscriminadamente.

As listas pessoais são paginadas em grupos de 50 registros. O mapa consulta até
500 pontos por área e pede para aproximar ou filtrar quando esse limite é atingido.
Os totais do painel e do perfil são consultados separadamente, sem baixar toda a base.

O workflow **Preparar e validar API Linux** constrói a imagem CPU, confere o template
Azure e executa inferência real em imagens sintéticas dentro do container. Ele não
publica na Azure. O workflow **Publicar API com modelo treinado** usa a mesma Release
e requer os IDs OIDC configurados em Actions. As configurações Supabase ficam em
secrets; os arquivos locais de configuração e o guia Azure não acompanham o Git.
