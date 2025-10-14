const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Importar middleware de upload
const { upload, handleUploadError } = require('./middleware/uploadValidation');

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Criar pasta uploads se não existir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

const pool = mysql.createPool(dbConfig);

// Teste de conexão com o banco
pool.getConnection()
    .then(connection => {
        console.log("✅ Conectado ao banco de dados MySQL");
        connection.release();
    })
    .catch(err => {
        console.error("❌ Erro ao conectar com o banco de dados:", err.message);
    });

// Importar e usar as rotas
const authRoutes = require("./routes/auth")(pool);
const productRoutes = require("./routes/products")(pool);
const categoryRoutes = require("./routes/categories")(pool);
const reviewRoutes = require("./routes/reviews")(pool);
const historicoRoutes = require("./routes/historico")(pool);
const productImageRoutes = require("./routes/product-images")(pool);
const productScraperRoutes = require("./routes/product-scraper")(pool);
const adapterRoutes = require("./routes/adapter")(pool);

// Aplicar middleware de upload para rotas específicas
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/historico", historicoRoutes);
app.use("/api/product-images", productImageRoutes);
app.use("/api/product-scraper", productScraperRoutes);
app.use("/api/adapter", adapterRoutes);

// Rota específica para upload de imagens de usuário com validação de 50MB
app.post('/api/upload/user-photo', upload.single('photo'), (req, res) => {
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
app.post('/api/upload/multiple', upload.array('files', 10), (req, res) => {
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

// Rota de teste
app.get("/", (req, res) => {
    res.json({ 
        message: "🚀 Roxinho Shop API está funcionando!",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: "/api/auth",
            products: "/api/products",
            categories: "/api/categories",
            reviews: "/api/reviews",
            historico: "/api/historico",
            uploads: "/api/upload"
        }
    });
});

// Rota de health check
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

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Algo deu errado'
    });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
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