# Genshin Builder

App web (PWA, instalável no celular) em português que lê uma conta de **Genshin Impact** e diz o que fazer com ela:
quais equipes você já consegue montar, que arma e artefatos cada personagem deveria usar, o que melhorar primeiro,
onde farmar cada material e quantos tiros faltam para o próximo 5★.

Projeto pessoal de fãs. **Não é afiliado à HoYoverse.** Nomes, imagens e dados do jogo pertencem à HoYoverse.

## O que ele faz

- **Hoje:** resina e comissões (Notas em Tempo Real), códigos de resgate ativos com link para o site oficial,
  domínios abertos no dia com o que falta para os seus personagens e chefes semanais pendentes.
- **Personagens:** nota dos artefatos (S a D), prontidão para combate (nível, arma, artefatos), artefatos ideais comparados
  peça por peça com os equipados, plano "como subir a nota", armas e talentos recomendados e onde farmar cada material.
- **Armas e artefatos:** com quem está cada peça e com quem deveria estar, com trocas que valem a pena.
- **Equipes:** equipes sugeridas (prontas, que precisam de preparo ou em que falta alguém), rotações com os botões
  do **PS5** ou do teclado, otimizador de trocas de artefatos/armas e um analisador que explica por que um time funciona ou não.
- **Desejos:** contador manual de pity por banner (50/50, Caminho Epitomizado, calculadora de primogemas).
- **Mapa:** pontos de cada material sobre o mapa oficial de Teyvat, com marcação do que já foi coletado.

## Segurança da conta

O app **nunca encosta no jogo**: não lê memória, não captura pacotes, não automatiza cliques nem modifica o cliente.
Ele só lê dados que a HoYoverse já publica:

| Fonte | O que precisa | O que lê |
|---|---|---|
| [Enka.Network](https://enka.network) | só o UID | personagens da Vitrine do perfil |
| HoYoLAB (Diário de Batalha) | login da HoYoverse **ou** cookies de leitura | todos os personagens, armas, artefatos, resina e Abismo |

- O login da HoYoLAB usa o mesmo endpoint do site oficial. A senha é cifrada com a chave pública da HoYoverse, enviada e
  descartada; o app guarda só os cookies de **leitura** (`ltuid_v2`/`ltoken_v2`), cifrados com AES-256-GCM.
- As consultas acontecem quando a pessoa toca em atualizar (no máximo uma por minuto) e as notas ficam em cache.

## Contas e privacidade

- Login próprio com **usuário e senha** (scrypt). Não há e-mail, nome real nem foto.
- Criar conta exige um **código de convite** (`INVITE_CODE`), que quem já usa o app vê em Conta › Convidar alguém.
- Recuperação de senha por **código de recuperação** mostrado ao criar a conta (e que pode ser gerado de novo na aba Conta).
- "Apagar conta e dados" remove tudo da pessoa.

## Rodando com Docker

```bash
cp .env.example .env        # defina INVITE_CODE e APP_SECRET
docker compose up -d --build
```

O app fica em `http://127.0.0.1:8787` (só na própria máquina). Para acessar de fora, use um túnel (por exemplo
Cloudflare Tunnel) ou um proxy reverso com HTTPS apontando para essa porta.

- `APP_SECRET` cifra os cookies da HoYoLAB no banco. Se mudar, cada pessoa precisa conectar a HoYoLAB de novo.
- O banco SQLite fica no volume `genshin-state`. Backup:
  `docker run --rm -v genshin-builder_genshin-state:/s -v "$PWD":/b alpine cp /s/genshin.db /b/genshin-$(date +%F).db`
- `scripts/weekly-update.sh` recompila a imagem baixando os dados mais novos do jogo; dá para agendar no cron
  (ex.: `0 5 * * 1 /caminho/genshin-builder/scripts/weekly-update.sh`).

## Desenvolvimento

Requer Node 22.5+ (usa o SQLite embutido do Node).

```bash
npm install
npm run update-data    # baixa nomes/ícones (Enka), custos e fontes de materiais (genshin-db) e pontos do mapa
npm run dev            # interface em http://localhost:5173, API em :8787
npm test               # testes (vitest)
```

No modo de desenvolvimento, `BROWSER_LOGIN=1` liga um atalho que abre o Chrome local no hoyolab.com e captura os
cookies depois do login.

## Guias

Os guias ficam em `data/guides/` (JSON) e são relidos a cada consulta:

- `characters-*.json`: armas, sets, atributos principais, pesos de substatus, meta de Recarga e prioridade de talentos;
- `teams.json`: equipes com alternativas por posição, rotação e dicas.

Personagens, armas e sets são escritos pelo **nome em inglês** do jogo (lista em `data/valid-names.md`); os nomes em
português vêm do Enka. Depois de editar, rode `npm run validate-data`. Guias de personagens muito recentes têm
`"confidence": "baixa"` ou `"media"` e o app avisa isso na tela.

## Estrutura

```
server/src/   API (Express): auth, db (SQLite), enka, hoyolab, analysis (notas e planos), optimizer, farm, teamcheck…
web/src/      interface (React + Vite + PWA)
shared/       tipos e rótulos em português usados pelos dois lados
data/guides/  guias curados
scripts/      geração de dados, validação dos guias, empacotamento e atualização semanal
```

## Créditos

- [Enka.Network](https://enka.network) e [API-docs](https://github.com/EnkaNetwork/API-docs): vitrine por UID, nomes e ícones.
- [genshin.py](https://github.com/thesadru/genshin.py): referência dos endpoints da HoYoLAB.
- [genshin-db](https://github.com/theBowja/genshin-db): custos de ascensão/talentos e fontes de materiais.
- [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer): formato das chaves de atributos (GOOD).
- [hoyo-codes](https://github.com/seriaati/hoyo-codes): códigos de resgate ativos.
- Mapa interativo da HoYoLAB: imagens de Teyvat e pontos dos materiais.
