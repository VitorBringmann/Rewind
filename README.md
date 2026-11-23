# Rewind · site de votação

Site estático (HTML, CSS e JS puros, sem build) para GitHub Pages. Lê as categorias do Google Forms "Awards" e grava as indicações como respostas do próprio formulário, via Google Apps Script. Votação aberta a todos, uma resposta por e-mail.

## Arquivos

- `index.html`, `styles.css`, `app.js`: o site. Todas as artes são SVG próprias, inline no `index.html`.
- `config.js`: cole aqui a URL do Apps Script. Vazia = modo demonstração (categorias de exemplo, votos só no navegador).
- `apps-script/Code.gs`: o backend, colado no editor de Apps Script da planilha.

## Preparar o formulário

1. Adicione uma pergunta de resposta curta chamada **E-mail** (e, se quiser, uma chamada **Nome**). Elas não aparecem como categorias no site.
2. Cada outra pergunta (resposta curta, parágrafo, múltipla escolha ou lista) vira uma categoria.

## Ligar o backend

1. No editor do formulário: ⋮ > Editor de scripts. Cole o conteúdo de `apps-script/Code.gs`.
2. Implantar > Nova implantação > tipo **App da Web**. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**.
3. Copie a URL que termina em `/exec` e cole em `config.js` → `SCRIPT_URL`.

## Publicar no GitHub Pages

1. Suba esta pasta para a raiz de um repositório.
2. Settings > Pages > Deploy from a branch > `main` / `root`.

## Regras atuais

- Uma resposta por e-mail: o script recusa um e-mail que já respondeu.
- As respostas entram no próprio formulário (aba Respostas e planilha vinculada).
