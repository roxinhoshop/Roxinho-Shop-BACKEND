
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey"; // Use uma chave secreta forte em produção
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta 'uploads'
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware de autenticação JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) {
        return res.status(401).json({ status: "error", message: "Token de autenticação não fornecido." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ status: "error", message: "Token de autenticação inválido ou expirado." });
        }
        req.user = user;
        next();
    });
};

// Middleware para verificar se o usuário é admin
const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.isAdmin !== 1) {
        return res.status(403).json({ status: "error", message: "Acesso negado. Requer privilégios de administrador." });
    }
    next();
};

// Criar pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Endpoint raiz
app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "API Backend Node.js está funcionando",
        version: "1.0.0",
        endpoints: {
            test: "GET /api/test",
            produtos: "GET /api/produtos",
            produtoById: "GET /api/produtos/:id",
            produtosByCategoria: "GET /api/produtos/categoria/:categoriaId",
            produtosDestaque: "GET /api/produtos/destaque/lista",
            categorias: "GET /api/categorias",
            register: "POST /api/register",
            login: "POST /api/login",
            uploadImage: "POST /api/upload-image",
            listImages: "GET /api/images",
            adminDashboard: "GET /api/admin/dashboard"
        }
    });
});

// Endpoint de teste de conexão
app.get("/api/test", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 as test, NOW() as now");
        res.json({
            status: "success",
            message: "Conexão com banco de dados estabelecida",
            database: process.env.DB_NAME,
            result: rows[0]
        });
    } catch (error) {
        console.error("Erro no /api/test:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para listar todos os produtos ativos
app.get("/api/produtos", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.ativo = 1
            ORDER BY p.criado_em DESC
        `);
        
        res.json({
            status: "success",
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para buscar produto por ID
app.get("/api/produtos/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = ? AND p.ativo = 1
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Produto não encontrado"
            });
        }
        
        res.json({
            status: "success",
            product: rows[0]
        });
    } catch (error) {
        console.error("Erro ao buscar produto:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para buscar produtos por categoria
app.get("/api/produtos/categoria/:categoriaId", async (req, res) => {
    try {
        const { categoriaId } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.categoria_id = ? AND p.ativo = 1
            ORDER BY p.criado_em DESC
        `, [categoriaId]);
        
        res.json({
            status: "success",
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error("Erro ao buscar produtos por categoria:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para buscar produtos em destaque
app.get("/api/produtos/destaque/lista", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.ativo = 1 AND p.destaque = 1
            ORDER BY p.criado_em DESC
        `);
        
        res.json({
            status: "success",
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error("Erro ao buscar produtos em destaque:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para registro de usuário
app.post("/api/register", async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ status: "error", message: "Nome, email e senha são obrigatórios." });
        }

        const [existingUser] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ status: "error", message: "Email já cadastrado." });
        }

        const hashedPassword = await bcrypt.hash(senha, 10);
        // Por padrão, novos usuários não são administradores (is_admin = 0)
        const [result] = await pool.query("INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, 0)", [nome, email, hashedPassword]);

        res.status(201).json({ status: "success", message: "Usuário registrado com sucesso!", userId: result.insertId });
    } catch (error) {
        console.error("Erro ao registrar usuário:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Endpoint para login de usuário
app.post("/api/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ status: "error", message: "Email e senha são obrigatórios." });
        }

        const [users] = await pool.query("SELECT id, nome, email, senha, is_admin FROM usuarios WHERE email = ?", [email]);
        const user = users[0];

        if (!user) {
            return res.status(401).json({ status: "error", message: "Credenciais inválidas." });
        }

        const isPasswordValid = await bcrypt.compare(senha, user.senha);
        if (!isPasswordValid) {
            return res.status(401).json({ status: "error", message: "Credenciais inválidas." });
        }

        const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ status: "success", message: "Login realizado com sucesso!", token, user: { id: user.id, nome: user.nome, email: user.email, is_admin: user.is_admin } });
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Endpoint para listar categorias
app.get("/api/categorias", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                c.*,
                COUNT(p.id) as total_produtos
            FROM categorias c
            LEFT JOIN produto p ON c.id = p.categoria_id AND p.ativo = 1
            GROUP BY c.id
            ORDER BY c.nome
        `);
        
        res.json({
            status: "success",
            count: rows.length,
            categories: rows
        });
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para criar nova categoria (admin)
app.post("/api/categorias", authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { nome, slug } = req.body;
        if (!nome) {
            return res.status(400).json({ status: "error", message: "Nome da categoria é obrigatório." });
        }
        const categorySlug = slug || nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const [result] = await pool.query("INSERT INTO categorias (nome, slug) VALUES (?, ?)", [nome, categorySlug]);
        res.status(201).json({ status: "success", message: "Categoria criada com sucesso!", categoryId: result.insertId });
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Endpoint para atualizar categoria (admin)
app.put("/api/categorias/:id", authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, slug } = req.body;
        if (!nome) {
            return res.status(400).json({ status: "error", message: "Nome da categoria é obrigatório." });
        }
        const categorySlug = slug || nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const [result] = await pool.query("UPDATE categorias SET nome = ?, slug = ? WHERE id = ?", [nome, categorySlug, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: "error", message: "Categoria não encontrada." });
        }
        res.json({ status: "success", message: "Categoria atualizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar categoria:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Endpoint para deletar categoria (admin)
app.delete("/api/categorias/:id", authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Verificar se existem produtos associados a esta categoria
        const [products] = await pool.query("SELECT id FROM produto WHERE categoria_id = ? AND ativo = 1", [id]);
        if (products.length > 0) {
            return res.status(400).json({ status: "error", message: "Não é possível deletar categoria com produtos ativos associados." });
        }
        const [result] = await pool.query("DELETE FROM categorias WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: "error", message: "Categoria não encontrada." });
        }
        res.json({ status: "success", message: "Categoria deletada com sucesso!" });
    } catch (error) {
        console.error("Erro ao deletar categoria:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Endpoint para criar novo produto (admin)
app.post("/api/produtos", authenticateToken, authorizeAdmin, upload.single("imagem"), async (req, res) => {
    try {
        const {
            nome, slug, descricao, descricao_curta, categoria_id,
            marca, modelo, sku, preco, preco_promocional, estoque,
            peso, dimensoes, galeria_imagens,
            especificacoes, ativo, destaque
        } = req.body;

        const imagem_principal = req.file ? `/uploads/${req.file.filename}` : req.body.imagem_principal;

        const [result] = await pool.query(`
            INSERT INTO produto (
            nome, slug, descricao, descricao_curta, categoria_id,
            marca, modelo, sku, preco, preco_promocional, estoque,
            peso, dimensoes, imagem_principal, galeria_imagens,
            especificacoes, ativo, destaque
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            nome, slug, descricao, descricao_curta, categoria_id,
            marca, modelo, sku, preco, preco_promocional || null, estoque,
            peso, dimensoes, imagem_principal, 
            galeria_imagens ? JSON.stringify(galeria_imagens) : null,
            especificacoes ? JSON.stringify(especificacoes) : null,
            ativo !== undefined ? ativo : 1,
            destaque !== undefined ? destaque : 0
        ]);

        res.status(201).json({
            status: "success",
            message: "Produto criado com sucesso",
            productId: result.insertId
        });
    } catch (error) {
        console.error("Erro ao criar produto:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para atualizar produto (admin)
app.put("/api/produtos/:id", authenticateToken, authorizeAdmin, upload.single("imagem"), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        if (req.file) {
            updates.imagem_principal = `/uploads/${req.file.filename}`;
        } else if (updates.imagem_principal === "") { // Se a imagem principal for limpa
            updates.imagem_principal = null;
        }

        const fields = Object.keys(updates);
        const values = Object.values(updates);
        
        if (fields.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Nenhum campo para atualizar"
            });
        }
        
        const setClause = fields.map(field => {
            if (field === "galeria_imagens" || field === "especificacoes") {
                return `${field} = ?`; // Não usar JSON_UNQUOTE aqui, o MySQL2 já faz isso com JSON.stringify
            }
            return `${field} = ?`;
        }).join(", ");

        values.push(id);
        
        const [result] = await pool.query(
            `UPDATE produto SET ${setClause} WHERE id = ?`,
            values
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Produto não encontrado"
            });
        }
        
        res.json({
            status: "success",
            message: "Produto atualizado com sucesso"
        });
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para deletar produto (soft delete) (admin)
app.delete("/api/produtos/:id", authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.query(
            "UPDATE produto SET ativo = 0 WHERE id = ?",
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Produto não encontrado"
            });
        }
        
        res.json({
            status: "success",
            message: "Produto desativado com sucesso"
        });
    } catch (error) {
        console.error("Erro ao deletar produto:", error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Endpoint para upload de imagem (admin)
app.post("/api/upload-image", authenticateToken, authorizeAdmin, upload.single("imagem"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: "error", message: "Nenhum arquivo enviado." });
        }
        res.json({
            status: "success",
            message: "Imagem enviada com sucesso!",
            url: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        console.error("Erro ao fazer upload de imagem:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Endpoint para listar imagens (admin)
app.get("/api/images", authenticateToken, authorizeAdmin, (req, res) => {
    const uploadPath = path.join(__dirname, "uploads");
    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            console.error("Erro ao listar imagens:", err);
            return res.status(500).json({ status: "error", message: "Erro ao listar imagens." });
        }
        const images = files.map(file => ({
            url: `/uploads/${file}`,
            name: file
        }));
        res.json({ status: "success", images });
    });
});

// Endpoint para Dashboard Admin (admin)
app.get("/api/admin/dashboard", authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        // Total de Usuários
        const [totalUsersResult] = await pool.query("SELECT COUNT(*) as total FROM usuarios");
        const totalUsers = totalUsersResult[0].total;

        // Total de Produtos Ativos
        const [totalProductsResult] = await pool.query("SELECT COUNT(*) as total FROM produto WHERE ativo = 1");
        const totalProducts = totalProductsResult[0].total;

        // Total de Vendas (simulado, pois não há tabela de pedidos/vendas)
        const totalPurchases = 0; // Substituir com dados reais quando a tabela de pedidos existir

        // Receita Total (simulado)
        const totalRevenue = 0.00; // Substituir com dados reais quando a tabela de pedidos existir

        // Produtos Recém-Adicionados (últimos 5)
        const [recentProducts] = await pool.query(`
            SELECT 
                p.id, p.nome, p.preco, p.preco_promocional, p.estoque, p.imagem_principal
            FROM produto p
            WHERE p.ativo = 1
            ORDER BY p.criado_em DESC
            LIMIT 5
        `);

        res.json({
            status: "success",
            stats: {
                totalUsers,
                totalProducts,
                totalPurchases,
                totalRevenue
            },
            recentProducts
        });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
    res.status(404).json({
        status: "error",
        message: "Endpoint não encontrado",
        path: req.path
    });
});

// Iniciar servidor
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor Node.js rodando em http://localhost:${port}`);
    });
}

// Exportar para Vercel
module.exports = app;

