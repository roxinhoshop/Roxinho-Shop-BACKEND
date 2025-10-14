# Roxinho Shop Backend - Documentação da API

## Base URL
```
https://roxinho-shop-backend.vercel.app
```

## Endpoints Disponíveis

### 1. Health Check
- **URL:** `/api/health`
- **Método:** GET
- **Descrição:** Verifica se a API está funcionando
- **Resposta de Sucesso:**
```json
{
  "status": "success",
  "message": "API funcionando corretamente",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Login
- **URL:** `/api/auth/login`
- **Método:** POST
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "email": "usuario@email.com",
  "senha": "senha123"
}
```
- **Resposta de Sucesso:**
```json
{
  "status": "success",
  "message": "Login realizado com sucesso",
  "token": "jwt_token_aqui",
  "usuario": {
    "id": 1,
    "nome": "Nome do Usuário",
    "email": "usuario@email.com"
  }
}
```

### 3. Registro
- **URL:** `/api/auth/register`
- **Método:** POST
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "nome": "Nome do Usuário",
  "email": "usuario@email.com",
  "senha": "senha123"
}
```
- **Resposta de Sucesso:**
```json
{
  "status": "success",
  "message": "Usuário cadastrado com sucesso",
  "token": "jwt_token_aqui",
  "usuario": {
    "id": 1,
    "nome": "Nome do Usuário",
    "email": "usuario@email.com"
  }
}
```

### 4. Histórico de Visualização
- **URL:** `/api/historico`
- **Método:** GET (para buscar) / POST (para adicionar)
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`

#### GET - Buscar Histórico
- **Resposta de Sucesso:**
```json
{
  "status": "success",
  "historico": [
    {
      "id": 1,
      "produto_id": 1,
      "usuario_id": 1,
      "data_visualizacao": "2024-01-01T00:00:00.000Z",
      "nome": "Nome do Produto",
      "preco": 99.99,
      "imagem_url": "https://exemplo.com/imagem.jpg"
    }
  ]
}
```

#### POST - Adicionar ao Histórico
- **Body:**
```json
{
  "produto_id": 1
}
```
- **Resposta de Sucesso:**
```json
{
  "status": "success",
  "message": "Produto adicionado ao histórico"
}
```

## Códigos de Erro Comuns
- `400` - Bad Request (dados inválidos)
- `401` - Unauthorized (token inválido ou ausente)
- `404` - Not Found (recurso não encontrado)
- `405` - Method Not Allowed (método HTTP incorreto)
- `409` - Conflict (email já cadastrado)
- `500` - Internal Server Error (erro do servidor)

## Notas Importantes
1. Todos os endpoints suportam CORS
2. O token JWT expira em 24 horas
3. Limite de upload de imagens: 50MB
4. Todas as senhas são criptografadas com bcrypt