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
npm start                 # sobe o servidor em http://localhost:3000
```

Não precisa rodar nada além disso: o servidor aplica as migrations e o seed
(dados de exemplo) sozinho toda vez que sobe, e é seguro repetir — ele nunca
apaga ou duplica dados que já existem, só cria o que ainda está faltando.
`npm run migrate` e `npm run seed` continuam disponíveis separadamente, caso
você queira rodá-los sem subir o servidor inteiro.

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
   Add PostgreSQL**. Isso cria um segundo "card" no projeto, separado do
   card da sua aplicação.
2. O Railway gera as credenciais do banco (incluindo uma `DATABASE_URL`), mas
   elas ficam guardadas **dentro do serviço do Postgres** — o serviço da sua
   aplicação (Node.js) ainda não enxerga isso automaticamente. Esse último
   passo é feito manualmente na próxima etapa.

### 4. Configure as variáveis de ambiente do serviço da aplicação

Clique no card do **serviço Node.js** (não no card do Postgres) e abra a aba
**Variables**. Adicione três variáveis:

**a) `DATABASE_URL` (conectando ao Postgres)**

1. Clique em **New Variable**.
2. No campo de nome, comece a digitar `DATABASE_URL` — o Railway mostra uma
   sugestão de autocompletar referenciando o banco Postgres do projeto
   (algo como `Postgres.DATABASE_URL`). Clique nessa sugestão em vez de
   digitar um valor manualmente.
3. Confirme/salve. Agora o serviço da aplicação está de fato ligado ao banco.

**b) `SESSION_SECRET`**

Gere uma string aleatória localmente (no PowerShell, dentro da pasta do
projeto):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o texto que aparecer e cole como valor de uma nova variável chamada
`SESSION_SECRET`.

**c) `NODE_ENV`**

Adicione uma variável `NODE_ENV` com valor `production`.

`PORT` não precisa ser adicionado — o Railway injeta essa variável sozinho
em todo serviço web. Depois de salvar as três variáveis acima, o Railway
publica um novo deploy automaticamente.

### 5. Nada a fazer aqui — o próprio servidor cria as tabelas e popula o banco

Diferente de outros guias que pedem para rodar `railway run npm run migrate`
manualmente, este projeto não precisa disso: toda vez que o servidor sobe
(no primeiro deploy e em qualquer deploy seguinte), ele mesmo cria as
tabelas que faltarem e popula o banco com os 28 usuários / 27 pessoas / 61
turnos de exemplo antes de começar a aceitar requisições — visível nos
**Logs** do serviço no Railway como "Applying database migrations..." e
"Applying seed data...". É seguro: ele nunca apaga ou duplica dados que já
existirem, só cria o que está faltando. (Rodar isso manualmente pelo seu
computador com `railway run` tende a dar problema, porque o endereço interno
do Postgres do Railway só é alcançável de dentro da rede do próprio Railway —
por isso o servidor faz isso sozinho, já rodando lá dentro.)

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
