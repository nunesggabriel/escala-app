# Escala de Trabalho

Calendário de turnos da equipe — versão standalone com backend em Node.js
(Express) e banco de dados PostgreSQL real. Qualquer pessoa com o link pode
acessar, sem precisar de conta Claude: o controle de acesso é feito pelos
e-mails cadastrados no próprio sistema.

Esta versão substitui o protótipo feito como Claude Artifact: agora as senhas
ficam com hash bcrypt no servidor, a autorização (quem pode criar/editar/
excluir o quê) é verificada no backend a cada requisição, e os dados moram em
um Postgres de verdade — não mais preso a uma conta pessoal da Claude.

## O que já vem pronto

- Calendário com visões Dia / Semana / Mês e filtro "Presencial"
- Categorias de turno totalmente editáveis (Férias, Chat, 22h, Home Office,
  Plantão já vêm prontas, e um admin pode criar/renomear/recolorir/desativar
  outras a qualquer momento em "Gerenciar categorias")
- Lançamento de turno único, período (data inicial/final) ou recorrência
  semanal, com exclusão "só este dia" ou "todos os vinculados"
- Cadastro de pessoas (grupo Geral / Implantação, ativo/inativo)
- Cadastro de usuários por e-mail com 3 papéis:
  - **Admin**: acesso total
  - **Usuário**: só edita/exclui os turnos que ele mesmo criou
  - **Implantação**: só cria/exclui turnos de pessoas do grupo Implantação
  - qualquer não-admin pode ser bloqueado para "somente visualização"
- Primeiro acesso: o usuário digita o e-mail cadastrado e cria sua própria
  senha; depois disso fica logado no navegador até clicar em "Sair"
- Tema claro/escuro
- Todos os 61 turnos, 27 pessoas e 28 usuários de exemplo já usados no
  protótipo, prontos para popular o banco (script de seed, veja abaixo)

## Estrutura do projeto

```
escala-app/
├── server/           # backend Express
│   ├── index.js      # ponto de entrada
│   ├── db.js         # pool de conexão Postgres
│   ├── migrate.js     # roda as migrations
│   ├── seed.js        # popula o banco com os dados de exemplo
│   ├── middleware/auth.js
│   ├── lib/           # helpers de permissão e datas (compartilhados)
│   └── routes/         # auth, people, users, shifts
├── migrations/001_init.sql
├── public/            # frontend estático (HTML/CSS/JS puro, sem build)
├── package.json
└── .env.example
```

## Rodando localmente

Pré-requisitos: Node.js 18+ e um Postgres acessível (local ou remoto).

```bash
npm install
cp .env.example .env      # edite DATABASE_URL e SESSION_SECRET
npm run setup             # roda as migrations e o seed (dados de exemplo)
npm start                 # sobe o servidor em http://localhost:3000
```

Abra `http://localhost:3000`. No primeiro acesso, use um dos e-mails já
cadastrados (por exemplo `gabriel.criabitat@gmail.com`, que já é admin) e crie
uma senha na hora.

## Publicando no Railway

O Railway foi a opção escolhida para colocar isso no ar. Passo a passo:

### 1. Suba o código para o GitHub

O jeito mais simples de o Railway acompanhar atualizações é a partir de um
repositório Git. Se você ainda não tem um:

```bash
cd escala-app
git init
git add .
git commit -m "Escala de Trabalho - versão standalone"
```

Crie um repositório vazio no GitHub (pode ser privado) e siga as instruções
que o próprio GitHub mostra para enviar (`git remote add origin ...` e
`git push`).

### 2. Crie o projeto no Railway

1. Entre em [railway.app](https://railway.app) e crie uma conta (ou faça
   login) — essa é a parte que só você pode fazer, já que a hospedagem final
   precisa de uma conta sua.
2. Clique em **New Project → Deploy from GitHub repo** e escolha o
   repositório que você acabou de criar.
3. O Railway detecta automaticamente que é um projeto Node.js (pelo
   `package.json`) e já configura o build/start (`npm start`).

### 3. Adicione o banco Postgres

1. Dentro do mesmo projeto no Railway, clique em **+ New → Database →
   Add PostgreSQL**.
2. O Railway cria o banco e já injeta a variável `DATABASE_URL` no serviço da
   sua aplicação automaticamente — você não precisa copiar/colar nada.

### 4. Configure as variáveis de ambiente do serviço da aplicação

No serviço do Node.js (não no do Postgres), vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `SESSION_SECRET` | uma string aleatória longa (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `NODE_ENV` | `production` |

`DATABASE_URL` e `PORT` já vêm prontos do Railway — não precisa mexer.

### 5. Rode as migrations e o seed no banco do Railway

Depois do primeiro deploy, rode uma única vez (com a Railway CLI instalada e
logada — `npm i -g @railway/cli` e `railway login`):

```bash
railway link          # conecta a pasta do projeto ao projeto certo no Railway
railway run npm run migrate
railway run npm run seed
```

Isso cria as tabelas e popula o banco com os 28 usuários / 27 pessoas / 61
turnos de exemplo (o seed nunca sobrescreve dados que já existirem — pode
rodar de novo sem medo de duplicar nada).

### 6. Acesse

O Railway gera uma URL pública do tipo `https://seu-projeto.up.railway.app`
(em **Settings → Networking → Generate Domain**, caso ainda não tenha uma).
Esse é o link que você compartilha com a equipe — qualquer pessoa com um dos
e-mails cadastrados consegue entrar, criar sua senha no primeiro acesso e
ficar logada normalmente, de qualquer computador, sem precisar de conta
Claude nem de convite especial.

## Gerenciando usuários depois de publicado

Uma vez logado como admin, use o ícone de escudo na barra lateral esquerda
("Gerenciar usuários") para:

- adicionar novos e-mails (a pessoa cria a própria senha no primeiro acesso)
- trocar o papel (Admin / Usuário / Implantação)
- bloquear alguém para "somente visualização"
- desativar ou remover um acesso
- redefinir a senha de alguém (a pessoa cria uma nova senha no próximo login)

O ícone de pessoas ("Gerenciar pessoas") controla a lista de nomes
disponíveis para lançar turnos, e o grupo (Geral / Implantação) de cada um.

O ícone de etiqueta ("Gerenciar categorias") controla os tipos de turno
(Férias, Chat, 22h, Home Office, Plantão, e qualquer outro que você criar):
nome, cor e se ela entra no filtro "Presencial". Uma categoria só pode ser
removida se nenhum turno já lançado estiver usando ela — nesses casos,
desative-a em vez de excluir (ela some da lista de novos turnos, mas os
turnos antigos continuam aparecendo normalmente no calendário).

## Atualizando uma instalação já existente

Se você já rodou este projeto antes (local ou no Railway) e recebeu uma
versão mais nova do código: basta substituir os arquivos do projeto pelos
novos (sem mexer no seu `.env`, que fica só na sua máquina/no Railway) e
rodar `npm run migrate` de novo. As migrations são sempre seguras de repetir
— elas só criam o que ainda não existe e nunca apagam dados que você já
lançou no calendário. Depois, reinicie o servidor (`npm start` local, ou um
novo deploy no Railway).

## Segurança

- Senhas: hash com `bcrypt` (custo 10), nunca em texto puro, nunca enviadas
  ao navegador.
- Sessão: cookie `httpOnly`, assinado com `SESSION_SECRET`, guardado no
  próprio Postgres (tabela `session`) — sobrevive a reinícios do servidor e
  fica válido por até 1 ano ou até a pessoa clicar em "Sair", como pedido.
- Autorização: cada rota da API confere no banco, a cada requisição, se quem
  está pedindo tem permissão para aquela ação específica — não é mais uma
  checagem só no navegador. Trocar o papel de alguém ou bloquear a edição
  tem efeito imediato, mesmo que a pessoa já esteja com a página aberta.
- Ajuste `SESSION_SECRET` para um valor único e aleatório em produção (nunca
  reutilize o do `.env.example`).

## Limitações conhecidas

- Não há tempo real (websockets): o navegador busca dados novos a cada ~20
  segundos, então uma mudança feita por outra pessoa pode levar até esse
  tempo para aparecer na tela de quem já está com a página aberta.
- Não há recuperação de senha por e-mail — se alguém esquecer a senha, um
  admin precisa usar "Redefinir senha" na tela de gerenciar usuários.
