# IDrafty

Assistente de draft para o modo Ranqueado de Brawl Stars. Permite montar equipes, consultar matchups e comparar candidatos a last pick contra os adversários conhecidos.

A página inicial (`/`) apresenta o IDrafty. A ferramenta de draft fica disponível em `/draft`, também pelo botão **Draft** da navegação.

> **Importante:** a base incluída é demonstrativa e contém estimativas manuais. As notas não são probabilidades de vitória. Verifique e atualize os dados antes de tomar decisões competitivas com base neles.

## Funcionalidades

- Montagem interativa das equipes e seleção de mapa/modo.
- Ranking de picks e análise de last pick.
- Comparação dos matchups contra cada adversário.
- Avaliação de sinergia, adequação ao terreno e cobertura da equipe.
- Consulta de matchups e edição local de registros manuais.
- Persistência local do draft e dos matchups personalizados.
- Indicador de cobertura dos dados de matchup e alertas quando há informações ausentes.

## Executar localmente

Requer Node.js compatível com as dependências do projeto.

```sh
npm install
npm run dev
```

## Testes e validação

```sh
npm test
npm run lint
npm run build
```

## Manutenção da base

Consulte [`DATA.md`](./DATA.md) para a estrutura dos dados, escala de matchups, prioridades de contexto e processo de atualização.

## Limitações atuais

- Os dados de brawlers, mapas, matchups e sinergias ainda não constituem uma base competitiva completa nem validada.
- As recomendações são determinísticas e dependem diretamente da qualidade dos dados.
- Os registros adicionados pela interface ficam no navegador atual; não há sincronização em nuvem nem autenticação administrativa.


### Catálogo de brawlers e imagens

O projeto contém 109 brawlers, sem duplicatas, incluindo Lightyear como indisponível. Retratos e links diretos das imagens são carregados do BrawlAPI/Brawlify quando há conexão com a internet; se a fonte estiver indisponível, o seletor usa as iniciais do personagem como fallback. Veja `DATA.md` para detalhes.


## Estratégia de draft (guia de counters)

A lógica do guia fornecido está em `src/data/strategy-guide.ts`. O ranking aplica pontos extras por META/Sub-Meta, destaque no mapa, counters/hard counters e sinergias recomendadas. Os cartões mostram selos e avisos de possível last pick; ao abrir as informações de um brawler, é possível consultar counters, hard counters, sinergias e mapas destacados.

Os dados são orientações estratégicas aproximadas do guia, não taxas oficiais de vitória. Para detalhes das regras e da única entrada ambígua preservada sem interpretação automática, consulte `DATA.md`.
