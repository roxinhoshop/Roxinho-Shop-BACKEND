require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURAÇÃO CORS - IMPORTANTE!
// ==========================================
app.use(cors({
  origin: "*", // Permite todas as origens
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Adicionar headers manualmente também (segurança dupla)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization", "X-Requested-With");
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  next();
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || "switchback.proxy.rlwy.net",
  port: process.env.DB_PORT || 46156,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "neFMagcBhfWUyBoRNMCBBTCZsTeyeBja",
  database: process.env.DB_NAME || "railway"
};

// Criar pool de conexões
const pool = mysql.createPool(dbConfig);

// Disponibilizar pool globalmente
app.locals.db = pool;

// Rota raiz
app.get("/", (req, res) => {
  res.json({
    mensagem: "API Roxinho Shop - Backend",
    versao: "1.0.0",
    status: "online",
    cors: "enabled",
    endpoints: [
      "GET /",
      "GET /api/test",
      "POST /api/importacao/importar"
    ]
  });
});

// Rota de teste
app.get("/api/test", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({
      sucesso: true,
      mensagem: "Conexão com banco de dados OK",
      cors: "enabled"
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao conectar com banco de dados",
      erro: error.message
    });
  }
});

// Importar rotas
const importacaoRoutes = require("./routes/importacao");

// Usar rotas
app.use("/api/importacao", importacaoRoutes);

// Middleware 404
app.use((req, res) => {
  res.status(404).json({
    sucesso: false,
    mensagem: "Rota não encontrada",
    rota: req.originalUrl,
    metodo: req.method
  });
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error("Erro:", err);
  res.status(500).json({
    sucesso: false,
    mensagem: "Erro interno do servidor",
    erro: process.env.NODE_ENV === "development" ? err.message : "Erro interno"
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`✅ CORS habilitado para todas as origens`);
});
