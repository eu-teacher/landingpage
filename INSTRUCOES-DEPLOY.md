# Como colocar o site no ar — passo a passo

Site: **teachertaina.com.br**
Hospedagem: **GitHub Pages** (gratuito, sem propaganda, com HTTPS automático)

Você tem 2 arquivos prontos na sua pasta:
- `index.html` — o site
- `CNAME` — diz pro GitHub que o domínio é teachertaina.com.br

---

## PARTE 1 — Subir os arquivos no GitHub (~5 minutos)

1. Abra https://github.com e faça login.
2. No canto superior direito, clique no **+** e depois em **New repository**.
3. Preencha:
   - **Repository name**: `teachertaina-site` (pode ser qualquer nome)
   - Deixe como **Public** (precisa ser público pra usar GitHub Pages no plano grátis)
   - **NÃO** marque "Add a README file"
4. Clique em **Create repository**.
5. Na tela seguinte, clique no link **"uploading an existing file"** (fica no meio da página, na frase "Quick setup").
6. Arraste os dois arquivos da sua pasta (`index.html` e `CNAME`) pra dentro da área de upload.
7. Role pra baixo e clique em **Commit changes**.

✅ Arquivos enviados.

---

## PARTE 2 — Ativar o GitHub Pages (~1 minuto)

1. Ainda no seu repositório, clique em **Settings** (engrenagem no topo).
2. No menu da esquerda, clique em **Pages**.
3. Em **"Build and deployment"**:
   - **Source**: Deploy from a branch
   - **Branch**: `main` / `/ (root)` → clique em **Save**.
4. Aguarde 1–2 minutos. Recarregue a página. Vai aparecer uma mensagem verde: "Your site is live at https://SEU-USUARIO.github.io/teachertaina-site/"
5. No campo **"Custom domain"** ainda nessa página, digite: `teachertaina.com.br` e clique em **Save**.
   - Vai dar erro de DNS no começo. Normal. A gente arruma na PARTE 3.

---

## PARTE 3 — Apontar o domínio no Registro.br (~5 minutos + espera)

1. Entre em https://registro.br e faça login.
2. Vá em **Meus Domínios** → clique em `teachertaina.com.br`.
3. Procure por **"Editar Zona DNS"** ou **"Configurar DNS"**.

Adicione os seguintes registros (apague qualquer A ou CNAME antigo apontando pra outro lugar):

### Registros tipo A (4 linhas — apontam o domínio raiz)

| Tipo | Nome/Host | Valor |
|------|-----------|-------|
| A | (deixe em branco ou @) | `185.199.108.153` |
| A | (deixe em branco ou @) | `185.199.109.153` |
| A | (deixe em branco ou @) | `185.199.110.153` |
| A | (deixe em branco ou @) | `185.199.111.153` |

### Registro tipo CNAME (1 linha — apontar o www)

| Tipo | Nome/Host | Valor |
|------|-----------|-------|
| CNAME | `www` | `SEU-USUARIO.github.io.` (substitua pelo seu usuário do GitHub. O ponto no final é importante.) |

4. Salve as alterações.

⏰ **Espera**: o DNS pode levar de 15 minutos a 24 horas pra propagar. Normalmente fica pronto em menos de 1 hora.

---

## PARTE 4 — Confirmar e ligar o HTTPS

1. Volte em **GitHub → Settings → Pages**.
2. Quando o DNS propagar, o GitHub vai mostrar uma marca verde no Custom domain.
3. Marque a caixa **"Enforce HTTPS"** (vai estar disponível só depois que o DNS propagar).

✅ Pronto. Seu site fica em **https://teachertaina.com.br** com cadeado verde.

---

## Como atualizar o site no futuro

Quando você quiser mudar alguma coisa no site:

1. Edite o arquivo `index.html` localmente (ou me peça pra editar).
2. Vá no repositório no GitHub → clique no arquivo `index.html` → clique no ícone de lápis (editar).
3. Cole o novo conteúdo OU delete o arquivo e arraste a versão nova.
4. Commit changes. Em 1–2 minutos o site atualiza sozinho.

---

## Problemas comuns

- **"Site not found" depois de configurar tudo** → DNS ainda propagando. Espere mais 30min e tente em outro navegador / aba anônima.
- **"Domain does not resolve"** no GitHub Pages → cheque se os 4 IPs no Registro.br estão exatamente certos.
- **Site no ar mas sem cadeado HTTPS** → marque "Enforce HTTPS" no GitHub. Se a opção estiver acinzentada, espere o DNS terminar de propagar.
