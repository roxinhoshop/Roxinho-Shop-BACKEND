# Guia de Deploy no Vercel

Este documento fornece instruções detalhadas para fazer o deploy do backend Node.js no Vercel.

## Pré-requisitos

Antes de iniciar o deploy, certifique-se de ter uma conta no Vercel e acesso ao repositório GitHub do projeto. Você também precisará das credenciais do banco de dados MySQL.

## Opção 1: Deploy via Interface Web do Vercel

### Passo 1: Conectar Repositório

Acesse o painel do Vercel em vercel.com e faça login com sua conta. Clique em "New Project" e selecione o repositório do backend no GitHub. O Vercel detectará automaticamente que se trata de um projeto Node.js.

### Passo 2: Configurar Variáveis de Ambiente

Na seção de configuração do projeto, adicione as seguintes variáveis de ambiente:

- **DB_HOST**: Host do banco de dados MySQL (exemplo: ballast.proxy.rlwy.net)
- **DB_PORT**: Porta do banco de dados (exemplo: 45057)
- **DB_NAME**: Nome do banco de dados (exemplo: railway)
- **DB_USER**: Usuário do banco de dados (exemplo: root)
- **DB_PASS**: Senha do banco de dados

### Passo 3: Deploy

Clique em "Deploy" e aguarde o processo de build e deploy. O Vercel irá instalar as dependências, executar o build e disponibilizar a aplicação em uma URL pública.

### Passo 4: Verificar Deploy

Após o deploy, acesse a URL fornecida pelo Vercel e teste o endpoint `/api/test` para verificar se a conexão com o banco de dados está funcionando corretamente.

## Opção 2: Deploy via Vercel CLI

### Instalação da CLI

Instale a CLI do Vercel globalmente usando npm:

```bash
npm install -g vercel
```

### Login

Faça login na sua conta Vercel:

```bash
vercel login
```

### Deploy

Na raiz do projeto backend, execute:

```bash
vercel
```

Siga as instruções interativas para configurar o projeto. Na primeira vez, você precisará confirmar as configurações do projeto.

### Configurar Variáveis de Ambiente

Você pode adicionar variáveis de ambiente via CLI:

```bash
vercel env add DB_HOST
vercel env add DB_PORT
vercel env add DB_NAME
vercel env add DB_USER
vercel env add DB_PASS
```

Ou configure-as diretamente no painel web do Vercel.

### Deploy para Produção

Para fazer deploy direto para produção:

```bash
vercel --prod
```

## Configuração do vercel.json

O arquivo `vercel.json` já está configurado corretamente com as seguintes definições:

- **version**: 2
- **builds**: Configura o uso do runtime Node.js
- **routes**: Redireciona todas as requisições para o index.js
- **env**: Define as variáveis de ambiente necessárias

## Testando a API Após Deploy

Após o deploy bem-sucedido, teste os seguintes endpoints:

- `GET /` - Informações da API
- `GET /api/test` - Teste de conexão com banco de dados
- `GET /api/produtos` - Lista de produtos
- `GET /api/categorias` - Lista de categorias

## Atualizações Futuras

Para atualizar o backend após mudanças no código:

1. Faça commit e push das alterações para o GitHub
2. O Vercel detectará automaticamente e fará o redeploy
3. Ou execute `vercel --prod` via CLI para deploy manual

## Troubleshooting

### Erro de Conexão com Banco de Dados

Verifique se as variáveis de ambiente estão configuradas corretamente no painel do Vercel. Certifique-se de que o banco de dados aceita conexões externas.

### Timeout nas Requisições

O Vercel tem um limite de 10 segundos para funções serverless no plano gratuito. Otimize as queries do banco de dados se necessário.

### Erro 404 em Endpoints

Verifique se o arquivo `vercel.json` está configurado corretamente e se as rotas estão definidas no `index.js`.

## Domínio Personalizado

Você pode adicionar um domínio personalizado no painel do Vercel, na seção "Domains" do projeto. O Vercel fornecerá instruções para configurar os registros DNS.

## Monitoramento

O Vercel oferece logs em tempo real e métricas de performance no painel do projeto. Acesse a seção "Logs" para visualizar requisições e erros.

## Suporte

Para mais informações, consulte a documentação oficial do Vercel em vercel.com/docs.

