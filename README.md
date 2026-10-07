# bot-viagens

Bot semi-automático de passagem barata para agência de turismo. Roda no **PC da agência**, busca tarifa no Google Flights (ou mock/API), espera alguém aprovar e só então manda no grupo de WhatsApp.

Origens padrão: São Paulo (GRU/CGH), Rio (GIG/SDU), Recife (REC) e Campinas (VCP). Quatro buscas por dia no horário de Brasília: 03:00, 09:00, 14:00 e 19:00.

## Aviso sobre WhatsApp e banimento

O envio usa [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web não oficial). Não usa a Cloud API da Meta.

Conta que dispara mensagem automática demais leva restrição ou ban. Use um **número Business só para o bot**, nunca o WhatsApp pessoal da agência. O teto padrão é 6 posts por dia. Se a Meta fechar a sessão, apague `data/whatsapp-auth/` e leia o QR de novo.

## Instalação (cliente)

```bash
git clone https://github.com/gabrielaapm/botviagem.git
cd botviagem
cp .env.example .env          # no Windows: copy .env.example .env
npm install
npx playwright install chromium   # obrigatório se SEARCH_ADAPTER=playwright
npm start
```

Requisitos: **Node.js 20+**, Windows/macOS/Linux, celular com WhatsApp (de preferência Business) para o QR.

1. Ajuste o `.env` (`BRAND_NAME`, `WHATSAPP_ADMIN_JID` do adm/cliente, etc.).
2. `WHATSAPP_ENABLED` começa em `false` — a fila abre em http://127.0.0.1:3847 sem conectar WhatsApp.
3. Para ir ao ar: `WHATSAPP_ENABLED=true`, `npm start`, leia o QR.
4. Sessão fica em `data/whatsapp-auth/` (não versionada). QR também em `data/whatsapp-qr.png` e na tela local.

## Fluxo QR → aprovar → grupo

1. No `.env`: `WHATSAPP_ENABLED=true`.
2. `npm start`. O QR aparece no terminal, em `data/whatsapp-qr.png` e na tela local.
3. No celular: **WhatsApp / Business → Aparelhos conectados → Conectar um aparelho**.
4. Na tela local (http://127.0.0.1:3847), escolha o grupo (ou preencha `WHATSAPP_GROUP_JID`).
5. Aprove uma oferta. O bot manda no grupo (se o teto do dia ainda não encheu).
6. Opcional: `WHATSAPP_ADMIN_JID` (ou `ADMIN_WHATSAPP_JID`) recebe no **PV** um resumo + link do Google Flights. **Não use o mesmo número da sessão do bot.**

Aprovação no terminal:

```bash
npm run approve
```

`a` = aprovar · `p` = pular · `q` = sair.

## Formato da mensagem no grupo

```
✈️ RIO DE JANEIRO | R$ 630

📅 4 → 11/11
✈️ CGH ⇄ Rio de Janeiro
⚡ Direto
🕐 08:20 → 09:25
🕐 18:40 → 19:45

💬 Quer fechar? Me chama no PV.

Valor sujeito a alteração até a emissão. Bagagem e assento conforme tarifa.
```

Horários (`🕐`) só aparecem se a busca trouxer esse dado. O bot **não publica sozinho** — só depois de aprovar.

## Busca no PV / grupo com “bot”

- **PV:** mensagens que começam com `bot` ou citam voo/passagem + origem/destino.
- **Grupo:** só mensagens que **começam com `bot`** (ex.: `bot, voo mais barato saindo de natal pra sao paulo no dia 15/11`).
- Escopo de data: **um dia** (`no dia 15/11`) ou **a semana** (`na semana do dia 10/11`). Sem isso o bot pede esclarecimento.

## Configuração

Veja `.env.example`.

| Variável | Função |
| --- | --- |
| `SEARCH_ADAPTER` | `playwright` (padrão), `mock` ou `api` |
| `WHATSAPP_ENABLED` | liga o Baileys (`false` na entrega) |
| `WHATSAPP_GROUP_JID` | grupo de destino (opcional) |
| `WHATSAPP_ADMIN_JID` | PV que recebe o link Google Flights após aprovar |
| `BRAND_NAME` | nome da agência (legado / telas) |
| `MAX_POSTS_PER_DAY` | teto de envios no dia (padrão 6) |
| `ORIGINS` | aeroportos de saída |
| `CHECK_HOURS` | horas das buscas em Brasília |
| `WEB_HOST` / `WEB_PORT` | tela local; deixe em `127.0.0.1` |

## Busca real (Playwright)

```bash
npx playwright install chromium
```

No `.env`: `SEARCH_ADAPTER=playwright`. O scraper lê a página de explorar destinos do Google Flights. Seletor muda e CAPTCHA pode aparecer — nesse caso a rodada volta vazia em vez de quebrar o bot. Funciona melhor no PC da agência do que em datacenter.

### Mock / API

- `SEARCH_ADAPTER=mock` — ofertas de exemplo, sem internet.
- `SEARCH_ADAPTER=api` + `FLIGHT_API_URL` — GET com `origin` e `currency=BRL` (ver `.env.example` / código).

Ofertas já vistas ficam ~14 dias em `data/offers.json` para não repetir na fila.

## Pastas

```
src/config      .env, origens, grupo salvo
src/search      adapter (mock, Playwright, API)
src/offers      fila, ranking, template, deeplink
src/inbound     parse de busca por mensagem (bot / voo)
src/whatsapp    Baileys, QR, teto diário, DM do adm
src/web         tela local de aprovação
src/scheduler   cron 03:00 / 09:00 / 14:00 / 19:00
src/copy        textos em pt-BR
src/cli         impressão e aprovação no terminal
```

`data/whatsapp-auth/` e `.env` **não** vão para o Git.

## Comandos

```bash
npm start       # bot completo
npm run mock    # uma busca (adapter do .env) e sai
npm run approve # fila no terminal
npm test
npm run typecheck
```

Textos de oferta, tela e terminal seguem o guia [humanizer](https://github.com/blader/humanizer): frase direta, sem abertura de palco e sem bordão de modelo.
