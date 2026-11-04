# Dados, treinamento e avaliação

O notebook `pipeline_buracos_yolo_v2.ipynb` documenta o detector YOLO11s do ViaAlerta.
O treinamento atual já terminou. Para executar a aplicação, use o `best.pt` salvo;
não execute o notebook inteiro nem a célula `modelo_yolo.train()`.

## Dataset local

Pasta ativa: `dados/preparados_buracos`.

```text
images/treino       labels/treino
images/validacao    labels/validacao
images/teste        labels/teste
```

| Divisão   | Imagens |
| --------- | ------: |
| Treino    |   5.269 |
| Validação |   1.091 |
| Teste     |     564 |
| Total     |   6.924 |

Há uma classe: `0 = buraco`. As 821 imagens de background identificadas no log
estão incluídas nas 5.269 imagens de treino.

Foram acrescentadas ao treino 483 imagens selecionadas do Pothole Dataset e 311
do Water-Filled and Dry Potholes. Validação e teste foram preservados nas importações.
Os arquivos de procedência e integração foram retirados desta cópia local.
Sem `manifesto.csv`, o notebook informa que as verificações de hashes do manifesto
e de grupos entre divisões não foram realizadas. Preserve ou recupere esses metadados
antes de um novo treinamento; a ausência deles não comprova ausência de vazamento.
As caixas duvidosas não foram inventadas nem convertidas automaticamente em negativos.
A triagem automática não substitui a revisão humana completa das anotações.

As fotos dos usuários ficam no Supabase e não são incluídas automaticamente neste
dataset. Um treinamento futuro exigiria seleção, anotação e uma nova avaliação.

## Ambiente e configuração utilizada

Ambiente registrado no treinamento: Python 3.11.9, Ultralytics 8.4.198,
PyTorch 2.11.0+cu130 e GPU NVIDIA GeForce RTX 5070.
`requirements.txt` lista as dependências de análise, treinamento e avaliação.
A API tem seu próprio requirements na pasta `api`. O arquivo do notebook não é
um lock completo do ambiente CUDA. Preserve o ambiente de treinamento funcional.

| Parâmetro      | Valor                |
| -------------- | -------------------- |
| Modelo inicial | `YOLO('yolo11s.pt')` |
| Épocas máximas | 300                  |
| Batch          | 0.80, AutoBatch      |
| Resolução      | 640                  |
| Seed           | 42                   |
| Patience       | 20                   |
| AMP            | True                 |
| Workers        | 0                    |
| Gráficos       | True                 |

Otimizador, learning rate, momentum e weight decay não foram configurados manualmente.
O augmentation padrão do Ultralytics é aplicado em memória, incluindo HSV, translate,
scale, horizontal flip e mosaic. Ele não cria um número fixo de imagens no disco.

## Checkpoint e recuperação

Execução: `treinamentos/buracos_aug_nativo_01/yolo_300ep-3`.
O treino executou 77 épocas e parou por early stopping; o log indica a época 57
como a melhor. Preserve `weights/best.pt` e `weights/last.pt`.

O `dados.yaml` do experimento foi restaurado após a falha na validação final.
O `args.yaml` foi reconstruído a partir dos argumentos do log, com essa origem
identificada em comentário. Ele não deve ser tratado como o arquivo original
preservado pelo treinador. Consulte `recuperacao_yaml.json` junto da execução.
A avaliação foi retomada separadamente, sem repetir o treinamento.

## Resultados atuais

Arquivo: `treinamentos/buracos_aug_nativo_01/avaliacao/metricas.csv`.

| Divisão   |  mAP50 | mAP50–95 | Precisão | Recall |     F1 |
| --------- | -----: | -------: | -------: | -----: | -----: |
| Validação | 0,5326 |   0,2319 |   0,6580 | 0,4620 | 0,5428 |
| Teste     | 0,5243 |   0,2285 |   0,6518 | 0,4732 | 0,5483 |

A avaliação usa confiança 0,25 para alertas e IoU 0,50 para o acerto de caixas.
O cálculo de mAP usa previsões a partir de confiança 0,001 e IoU de 0,50 a 0,95;
os critérios completos estão em `avaliacao/criterios.json`.
A acurácia de presença mede se há buraco na imagem, não a posição das caixas.

Os gráficos, matrizes e erros por imagem estão em `avaliacao` e
`validacao_recuperada`. As fontes RDD perderam informações de percurso; as divisões
não comprovam independência completa das cenas. É necessário avaliar imagens
locais antes de concluir sobre o desempenho no uso real.

## API

A implementação está em `../api/app.py` e a configuração local em `../api/.env`.
A última célula do notebook apenas informa o caminho do serviço, sem gerar código.
Para iniciar a API, abra um terminal na raiz do projeto e siga os comandos do
[README principal](../README.md). Use o checkpoint existente, sem executar o treino.

## Referências dos dados

Chitale, P. A.; Kekre, K. Y.; Shenai, H. R.; Karani, R.; Gala, J. P. (2020).
_Pothole Detection and Dimension Estimation System using Deep Learning (YOLO) and
Image Processing_. 35th International Conference on Image and Vision Computing
New Zealand. DOI: [10.1109/IVCNZ51579.2020.9290547](https://doi.org/10.1109/IVCNZ51579.2020.9290547).

Water-Filled and Dry Potholes: Jihad Dib, Konstantinos Sirlantzis e Gareth Howells,
[Mendeley Data, versão 1](https://data.mendeley.com/datasets/tp95cdvgm8/1).
