const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

// Importar configurações centralizadas
const config = require(\'./config\');

const app = express();
const PORT = config.server.port;

// Importar middleware de upload
const { upload, handleUploadError } = require(\'./middleware/uploadValidation\');

// Middleware
const allowedOrigins = process.env.NODE_ENV === \'production\'
    ? [config.server.frontendUrl, \'https://roxinho-shop.vercel.app\'] // Adiciona a URL do frontend Vercel explicitamente
    : [\'http://localhost:3000\', \'http://localhost:5173\', \'http://localhost:8080\', config.server.frontendUrl]; // URLs de desenvolvimento

app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem \'origin\' (ex: mobile apps, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = \'A política de CORS para este site não permite acesso a partir da origem \' + origin;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: [\'GET\', \'POST\', \'PUT\', \'DELETE\', \'OPTIONS\'],
    allowedHeaders: [\'Content-Type\', \'Authorization\', \'X-Requested-With\']
}));

app.use(express.json({ limit: `${config.upload.maxFileSize}` }));
app.use(express.urlencoded({ extended: true, limit: `${config.upload.maxFileSize}` }));

// Definir o diretório de uploads
const uploadsDir = process.env.NODE_ENV === \'production\' ? \'/tmp/uploads\' : path.join(__dirname, config.upload.uploadDir);

// Criar pasta uploads se não existir (apenas em desenvolvimento)
if (process.env.NODE_ENV !== \'production\' && !fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir arquivos estáticos da pasta uploads
app.use(\'/uploads\', express.static(uploadsDir));

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
        await pool.query(\'SELECT 1\');
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
const authRoutes = require(\'./routes/auth\')(pool);
const productRoutes = require(\'./routes/products\')(pool);
const categoryRoutes = require(\'./routes/categories\')(pool);
const reviewRoutes = require(\'./routes/reviews\')(pool);
const historicoRoutes = require(\'./routes/historico\')(pool);
const productImageRoutes = require(\'./routes/product-images\')(pool);
const categoriesEnhancedRoutes = require(\'./routes/categories-enhanced\')(pool);
const productApiIntegratorRoutes = require(\'./routes/product-api-integrator\')(pool);
const productsEnhancedRoutes = require(\'./routes/products-enhanced\')(pool);

// Aplicar rotas
app.use("/api" + config.endpoints.auth, authRoutes);
app.use("/api" + config.endpoints.products, productRoutes);
app.use("/api" + config.endpoints.categories, categoryRoutes);
app.use("/api" + config.endpoints.reviews, reviewRoutes);
app.use("/api" + config.endpoints.historico, historicoRoutes);
app.use("/api" + config.endpoints.productImages, productImageRoutes);
app.use("/api/categories-enhanced", categoriesEnhancedRoutes);
app.use("/api/product-integrator", productApiIntegratorRoutes);
app.use("/api/products-enhanced", productsEnhancedRoutes);

// Rota específica para upload de imagens de usuário com validação de 50MB
app.post(`${config.endpoints.upload}/user-photo`, upload.single(\'photo\'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: \'Nenhum arquivo foi enviado\'
            });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            message: \'Foto do usuário enviada com sucesso\',
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                url: fileUrl
            }
        });
    } catch (error) {
        console.error(\'Erro no upload da foto do usuário:\', error);
        res.status(500).json({
            success: false,
            error: \'Erro interno no servidor\'
        });
    }
});

// Rota para múltiplos uploads com validação
app.post(`${config.endpoints.upload}/multiple`, upload.array(\'files\', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: \'Nenhum arquivo foi enviado\'
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
        console.error(\'Erro no upload múltiplo:\', error);
        res.status(500).json({
            success: false,
            error: \'Erro interno no servidor\'
        });
    }
});

// Middleware de tratamento de erros de upload
app.use(handleUploadError);

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
    console.error(\'Erro não tratado:\', error);
    res.status(500).json({
        success: false,
        error: \'Erro interno do servidor\',
        message: process.env.NODE_ENV === \'development\' ? error.message : \'Algo deu errado\'
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
    console.log(`📱 Ambiente: ${process.env.NODE_ENV || \'development\'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
});

module.exports = app;
