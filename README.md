# Roxinho Shop - Backend Node.js

Backend da aplicação Roxinho Shop desenvolvido em Node.js com Express e MySQL.

## 🚀 Tecnologias

- Node.js
- Express.js
- MySQL2
- CORS
- dotenv

## 📦 Instalação

```bash
npm install
```

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
DB_HOST=seu_host
DB_PORT=sua_porta
DB_NAME=nome_do_banco
DB_USER=usuario
DB_PASS=senha
PORT=3000
```

## 🏃 Executar Localmente

```bash
node index.js
```

O servidor estará rodando em `http://localhost:3000`

## 📡 Endpoints da API

### Produtos

- `GET /api/produtos` - Lista todos os produtos ativos
- `GET /api/produtos/:id` - Busca produto por ID
- `GET /api/produtos/categoria/:categoriaId` - Lista produtos por categoria
- `GET /api/produtos/destaque/lista` - Lista produtos em destaque
- `POST /api/produtos` - Cria novo produto (admin)
- `PUT /api/produtos/:id` - Atualiza produto (admin)
- `DELETE /api/produtos/:id` - Desativa produto (admin)

### Categorias

- `GET /api/categorias` - Lista todas as categorias

### Teste

- `GET /api/test` - Testa conexão com banco de dados
- `GET /` - Informações da API

## 🌐 Deploy no Vercel

### Pré-requisitos

1. Conta no Vercel
2. Vercel CLI instalado (opcional)

### Passos para Deploy

#### Opção 1: Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

#### Opção 2: Via GitHub

1. Faça push do código para o GitHub
2. Importe o repositório no Vercel
3. Configure as variáveis de ambiente no painel do Vercel

### Configurar Variáveis de Ambiente no Vercel

No painel do Vercel, adicione as seguintes variáveis de ambiente:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

## 📝 Estrutura do Banco de Dados

### Tabela: produto

- `id` - INT (PK, AUTO_INCREMENT)
- `nome` - VARCHAR(200)
- `slug` - VARCHAR(200) UNIQUE
- `descricao` - TEXT
- `descricao_curta` - VARCHAR(500)
- `categoria_id` - INT (FK)
- `marca` - VARCHAR(100)
- `modelo` - VARCHAR(100)
- `sku` - VARCHAR(50) UNIQUE
- `preco` - DECIMAL(10,2)
- `preco_promocional` - DECIMAL(10,2)
- `estoque` - INT
- `peso` - DECIMAL(8,3)
- `dimensoes` - VARCHAR(100)
- `imagem_principal` - VARCHAR(255)
- `galeria_imagens` - JSON
- `especificacoes` - JSON
- `ativo` - TINYINT(1)
- `destaque` - TINYINT(1)
- `data_criacao` - TIMESTAMP
- `data_atualizacao` - TIMESTAMP

### Tabela: categorias

- `id` - INT (PK, AUTO_INCREMENT)
- `nome` - VARCHAR(100)
- `slug` - VARCHAR(100) UNIQUE
- `descricao` - TEXT
- `icone` - VARCHAR(50)
- `categoria_pai_id` - INT (FK)
- `ativo` - TINYINT(1)
- `ordem` - INT
- `data_criacao` - TIMESTAMP

## 🔒 Segurança

- As senhas do banco de dados são armazenadas em variáveis de ambiente
- CORS configurado para aceitar requisições do frontend
- Soft delete para produtos (não remove do banco, apenas marca como inativo)

## 📄 Licença

Este projeto é privado e pertence à Roxinho Shop.

## 👨‍💻 Desenvolvedor

Gabriel (gabwvr)


