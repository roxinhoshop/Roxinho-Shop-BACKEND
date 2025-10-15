


const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

// Importar configurações centralizadas
const config = require('./config');

console.log("--- Variáveis de Ambiente do Banco de Dados (process.env) ---");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_DATABASE:", process.env.DB_DATABASE);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "********" : "Não definida");
console.log("--- process.env completo (temporário para depuração) ---");
const envToLog = { ...process.env };
if (envToLog.DB_PASSWORD) envToLog.DB_PASSWORD = "********";
if (envToLog.JWT_SECRET) envToLog.JWT_SECRET = "********";
console.log(envToLog);
console.log("---------------------------------------------------------");
console.log("----------------------------------------------------------");

console.log("--- Configuração do Banco de Dados (config.database) ---");
console.log("Host:", config.database.host);
console.log("Port:", config.database.port);
console.log("Database:", config.database.name);
console.log("User:", config.database.user);
console.log("Password:", config.database.password ? "********" : "Não definida");
console.log("--------------------------------------------------------");

const app = express();
const PORT = config.server.port;

// Importar middleware de upload
const { upload, handleUploadError } = require('./middleware/uploadValidation');

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://roxinho-shop.vercel.app' : '*', // Restringe o domínio em produção, permite todos em desenvolvimento
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: `${config.upload.maxFileSize}` }));
app.use(express.urlencoded({ extended: true, limit: `${config.upload.maxFileSize}` }));

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, config.upload.uploadDir)));

// Criar pasta uploads se não existir
const uploadsDir = path.join(__dirname, config.upload.uploadDir);
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do banco de dados
const dbConfig = {
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    port: config.database.port,
    waitForConnections: true,
    connectionLimit: config.database.connectionLimit,
    queueLimit: config.database.queueLimit,
    acquireTimeout: config.database.acquireTimeout,
    timeout: config.database.timeout,
    reconnect: true
};

let pool;
if (!config.database.host) {
    console.warn("⚠️ Usando pool de conexão mockado para ambiente de desenvolvimento ou sem DB_HOST.");
    pool = {
        getConnection: async () => ({
            query: async () => [],
            release: () => {},
            end: () => {}
        }),
        query: async () => [],
        end: () => {}
    };
} else {
    pool = mysql.createPool(dbConfig);
}

// Teste de conexão com o banco
if (config.database.host) {
    pool.getConnection()
        .then(connection => {
            console.log("✅ Conectado ao banco de dados MySQL");
            connection.release();
        })
        .catch(err => {
            console.error("❌ Erro ao conectar com o banco de dados:", err.message);
        });
}

// Rota de teste - DEVE VIR ANTES DAS OUTRAS ROTAS
app.get("/", (req, res) => {
    res.json({ 
        message: "🚀 Roxinho Shop API está funcionando!",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: config.endpoints.auth,
            products: config.endpoints.products,
            categories: config.endpoints.categories,
            reviews: config.endpoints.reviews,
            historico: config.endpoints.historico,
            uploads: config.endpoints.upload,
            productImages: config.endpoints.productImages,


        }
    });
});

// Rota de health check - DEVE VIR ANTES DAS OUTRAS ROTAS
app.get("/health", async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: "unhealthy",
            database: "disconnected",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Importar e usar as rotas
const authRoutes = require("./routes/auth")(pool);
const productRoutes = require("./routes/products")(pool);
const categoryRoutes = require("./routes/categories")(pool);
const reviewRoutes = require("./routes/reviews")(pool);
const historicoRoutes = require("./routes/historico")(pool);
const productImageRoutes = require("./routes/product-images")(pool);



// Aplicar rotas
app.use(config.endpoints.auth, authRoutes);
app.use(config.endpoints.products, productRoutes);
app.use(config.endpoints.categories, categoryRoutes);
app.use(config.endpoints.reviews, reviewRoutes);
app.use(config.endpoints.historico, historicoRoutes);
app.use(config.endpoints.productImages, productImageRoutes);



// Rota específica para upload de imagens de usuário com validação de 50MB
app.post(`${config.endpoints.upload}/user-photo`, upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum arquivo foi enviado'
            });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            message: 'Foto do usuário enviada com sucesso',
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                url: fileUrl
            }
        });
    } catch (error) {
        console.error('Erro no upload da foto do usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no servidor'
        });
    }
});

// Rota para múltiplos uploads com validação
app.post(`${config.endpoints.upload}/multiple`, upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum arquivo foi enviado'
            });
        }

        const files = req.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            url: `/uploads/${file.filename}`
        }));
        
        res.json({
            success: true,
            message: `${files.length} arquivo(s) enviado(s) com sucesso`,
            files: files
        });
    } catch (error) {
        console.error('Erro no upload múltiplo:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no servidor'
        });
    }
});

// Middleware de tratamento de erros de upload
app.use(handleUploadError);

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Algo deu errado'
    });
});

// Middleware para rotas não encontradas - DEVE VIR POR ÚLTIMO
app.use((req, res) => {
    res.status(404).json({
        status: "error",
        message: "Endpoint não encontrado",
        path: req.path,
        method: req.method
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
});

module.exports = app;

