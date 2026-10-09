# enxuto

Mod pro Claude Code: menos ruído no transcript, com cor.

- **Respostas**: `/enxuto curto` (padrão) pede ao modelo resposta curta mas inteira; `inteiro` deixa como vier; `dobra` dobra resposta longa nas 8 primeiras linhas.
- **Resposta longa** (mais de 14 linhas) ganha uma linha de botões: `encolher` / `abrir`, `salvar` (em `respostas/<data>.md` da pasta do projeto) e `copiar`. `/salvar` salva a última.
- **Tools**: cada chamada vira uma linha colorida pelo tipo, sem o resultado; chamada que falha aparece inteira. `/enxuto tools` liga e desliga.
- **Faixa acima do prompt**: um bloco por tool call do turno e o que está rodando agora.
- **Fim do turno**: uma linha com tempo, tools, falhas e arquivos mexidos (o modelo não lê).
- **`/turno`**: painel com cada tool call e quanto levou.
- **`/tema`**: `neon`, `brasa`, `mata`, `gelo`, `sunset`, `mono`.

Modo, tema e tools ficam salvos entre sessões.

## Instalar

Aponte `CLAUDE_CODE_PLUGIN_DIRS` (bloco `env` do `~/.claude/settings.json`) para esta pasta e abra uma sessão nova.

## Mexer

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

Os limites da dobra ficam no topo de `hooks/fold.ts`; as cores em `hooks/theme.ts`.
