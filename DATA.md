# Manutenção da base estratégica do IDrafty

A base atual é **demonstrativa**. Os valores de matchup, sinergia, função, alcance e adequação a mapas/modos são estimativas manuais, não estatísticas oficiais nem recomendações competitivas validadas. Antes de usar as notas como orientação de alto nível, revise os registros com dados atuais e partidas reais.

## Arquivos

- `src/data/brawlers.ts`: personagens, atributos, tags, pontos fortes/fracos e modos.
- `src/data/maps.ts`: modos e mapas, com características de terreno.
- `src/data/matchups.ts`: sinergias; matchups base são derivados do guia estratégico.
- `src/data/strategy-guide.ts`: counters e relações de matchup derivados do guia estratégico.
- `src/lib/draft/engine.ts`: cálculo de ranking; mantenha os dados separados da lógica.

## Matchups

Não há mais uma lista de matchups padrão estáticos. A seção Base do Banco e a referência inicial do motor usam as relações do Strategy Guide; matchups criados ou editados pelo usuário podem personalizar essas relações.

Cada entrada define a vantagem do `attacker` contra o `defender`, numa escala ordinal de -5 a +5:

- `+5`: vantagem muito forte
- `+3`: vantagem forte
- `+1`: vantagem moderada
- `0`: matchup neutro **somente se isso tiver sido avaliado**
- `-1`: desvantagem moderada
- `-3`: desvantagem forte
- `-5`: desvantagem muito forte

O motor utiliza a entrada inversa como fallback e inverte o sinal, salvo quando `asymmetric: true`. Use `mapId` ou `mode` para contextos específicos; registros mais específicos têm prioridade sobre os genéricos.

Todo registro deve incluir explicação, fonte, confiança, status e data de revisão. Não registre `0` só porque não há dados: deixe o matchup ausente. Ausência de dados é mostrada como desconhecida e afeta o indicador de confiança.

Exemplo de registro:

```ts
{
  attacker: "shelly",
  defender: "bull",
  score: 2,
  explanation: "Exemplo ilustrativo; validar antes de usar.",
  source: "revisão manual",
  confidence: "baixa",
  status: "avaliacao_manual",
  reviewed: "2026-10-29"
}
```

## Sinergias

As sinergias são definidas em `src/data/matchups.ts` e possuem dois IDs de brawler, nota ordinal de -3 a +3, justificativa, confiança e status. A relação é tratada como simétrica pelo motor atual.

## Pesos da nota estratégica

A nota estratégica usa os seguintes pesos: matchup (40%), sinergia (10%), adequação combinada ao modo e ao mapa (40%), cobertura da equipe (5%) e risco de fraquezas acumuladas (5%). Os pesos somam 100%. As pontuações dos componentes são estimativas normalizadas, não probabilidades de vitória.

Para a adequação do candidato, `bestModes` e `maps` de `src/data/strategy-guide.ts` são a fonte autoritativa. Os campos genéricos `goodModes` e os níveis de terreno não alteram esse componente. Uma recomendação explícita do guia recebe adequação alta; se o guia não tiver dados para aquela dimensão, a nota usa valor neutro em vez de inferir inadequação.

Cada entrada do guia também tem `worstMaps`, uma lista de IDs de mapas desfavoráveis
que aplica -2 pontos estratégicos por mapa correspondente. Uma lista vazia significa
que não há mapas desfavoráveis registrados.

## Mapas e adequação

`walls`, `bushes` e `openness` usam níveis de 1 a 3. Esses valores são aproximações estratégicas; mantenha-os revisados e não trate como medições oficiais. `goodBrawlers` deve permanecer vazio até haver evidência confiável suficiente para associar personagens diretamente ao mapa.

## Dados inseridos pela interface

Os matchups criados ou editados na página Banco, inclusive os derivados de `strategy-guide.ts`, são salvos no `localStorage` do navegador. As edições têm prioridade sobre os dados originais; exclusões de matchups do guia podem ser restauradas pela própria aba Matchups. Essas alterações não são sincronizadas entre dispositivos nem compartilhadas com outros usuários.

Na aba Matchups, gere o JSON em texto para copiar e compartilhar, ou cole um JSON na área de importação. O formato inclui regras personalizadas e exclusões do Strategy Guide, mas não inclui matchups padrão estáticos nem o campo legado `deletedMatchups`. A importação valida o formato IDrafty e mescla as regras: uma regra com a mesma identidade é atualizada, e as demais regras locais são preservadas. Anotações de brawlers e a base completa do guia não são incluídas.

## Atualizações de balanceamento

Após atualizações do jogo:

1. Revise os matchups afetados.
2. Atualize `reviewed` e a fonte de cada registro.
3. Ajuste atributos e sinergias que tenham mudado.
4. Rode os testes automatizados.
5. Reavalie as recomendações em drafts representativos.

As notas finais do aplicativo são **pontuações estratégicas ordinais**, não probabilidades de vitória.

## Retratos e links das imagens

O catálogo agora inclui os 109 brawlers fornecidos para o projeto. Os retratos são resolvidos pelo módulo `src/lib/draft/brawler-images.ts`, que consulta a API pública estática do BrawlAPI (`https://api.brawlapi.com/v1/brawlers`) e utiliza os campos `imageUrl2`/`imageUrl` do Brawlify CDN. Ao abrir as informações de um personagem no seletor, o link **Abrir imagem** abre o arquivo de imagem diretamente em outra aba.

A conexão é opcional: se a API estiver indisponível, a interface mostra as iniciais em vez de quebrar. Os nomes localizados `Corvo`, `Eugênio`, `Mister P`, `Wattson (Surge)` e `Coronel Ruffs` são associados aos nomes canônicos usados pela fonte de imagens. Lightyear permanece no catálogo, mas não pode ser selecionado enquanto estiver marcado como indisponível.

A fonte fornece imagens e dados do jogo; os atributos táticos genéricos dos brawlers adicionados continuam marcados como não verificados e não devem ser interpretados como counters validados.

## Raridades dos brawlers

Cada brawler possui o campo `rarity`, tipado em `src/lib/draft/types.ts`. A classificação cadastrada segue a distribuição fornecida para o projeto: Inicial (1), Raro (8), Super-raro (10), Épico (30), Mítico (43), Lendário (14) e Ultralendário (2). Lightyear permanece no catálogo histórico como `Indisponível`, pois não está disponível para seleção. O seletor agrupa por raridade e permite filtrar por categoria.

Se a classificação mudar, atualize `RARITY_IDS` em `src/data/brawlers.ts` e o teste de distribuição em `src/lib/draft/engine.test.ts`.

## Rotação de mapas do Ranqueado

A lista de mapas foi substituída pela lista fornecida em 29/10/2026: 26 mapas divididos entre Pique-Gema (4), Fura-Cofre (4), Caça-Estrelas (4), Fute-Brawl (4), Zona Estratégica (4) e Nocaute (6). Os nomes dos mapas permanecem em inglês para facilitar a correspondência com o jogo.

As miniaturas são resolvidas pelo componente `src/components/draft/MapImage.tsx`, que consulta `https://api.brawlapi.com/v1/maps` e usa o `imageUrl` do catálogo BrawlAPI/Brawlify. A imagem aparece ao lado de cada mapa na aba Banco e junto ao mapa selecionado no draft. É necessária conexão com a internet para carregar as imagens; se a API falhar, aparece um ícone substituto.

Os níveis de paredes, arbustos e abertura são estimativas iniciais para contexto visual, não estatísticas oficiais. A lista corrigida remove Beach Ball e Spiraling Out, e adiciona Flowing Springs e Goldarm Gulch. O teste de `src/lib/draft/engine.test.ts` verifica os 26 nomes e a distribuição por modo.

## Guia estratégico de counters e sinergias (29/10/2026)

O arquivo `src/data/strategy-guide.ts` contém os 108 brawlers do guia fornecido pelo usuário. Lightyear permanece fora do guia e indisponível no draft. As recomendações são estimativas estratégicas do documento, não estatísticas oficiais de vitórias.

Regras aplicadas ao ranking:

- META: +4 pontos e selo 🌟.
- Sub-Meta: +2 pontos e selo ✨.
- Brawler em destaque no mapa selecionado: +4 pontos.
- Brawler em mapa listado em `worstMaps`: -2 pontos.
- Brawler listado em `mogga` para um adversário: +5 pontos; essa regra tem prioridade sobre o counter normal.
- Countera melhor o inimigo: +2 pontos.
- É counterado pelo inimigo: -2 pontos.
- Hard counter presente na equipe adversária: -5 pontos (substitui a penalidade normal de -2 para o mesmo confronto).
- Sinergia recomendada entre aliados: +2 pontos por par, sem duplicar a mesma dupla.

Os pontos são adicionados à nota estratégica existente, limitada a 0–100; em empates de nota, o total de pontos estratégicos desempata antes da confiança dos dados. Os cartões e o seletor exibem os selos META/Sub-Meta e alertas ⚠ para picks de risco/possíveis last picks. O painel de informações mostra counters, hard counters, sinergias e mapas de destaque.

Aviso de last pick:

- Os lançadores identificados no guia (Barley, Dynamike, Grom, Tick, Sprout, Willow, Juju, Larry & Lawrie, Berry e Squeak) recebem alerta.
- Assassinos e tanques de curto alcance também recebem alerta genérico, conforme a orientação geral do guia.
- Avisos individuais descritos no guia aparecem nos cartões.

Uma entrada ambígua do arquivo original — `Byron Bo` na lista de hard counters de 8-Bit — não foi transformada automaticamente em dois brawlers; ela foi omitida da regra automática até confirmação. A linha de mapas de 8-Bit foi interpretada como destaque em Bridge Too Far, conforme o nome explicitamente citado.
