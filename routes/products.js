
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

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

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.isAdmin !== 1) {
        return res.status(403).json({ message: "Acesso negado. Requer privilégios de administrador." });
    }
    next();
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../uploads"); // Ajustado para subir um nível
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

// Rota para listar todos os produtos
router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM produto WHERE ativo = 1");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota para obter um produto por ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query("SELECT * FROM produto WHERE id = ? AND ativo = 1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Produto não encontrado." });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota para criar um novo produto (apenas admin)
router.post("/", authenticateToken, authorizeAdmin, upload.single("imagem"), async (req, res) => {
    try {
        const { nome, descricao, preco, estoque, categoria_id } = req.body;
        const imagem = req.file ? `/uploads/${req.file.filename}` : null;
        const [result] = await pool.query("INSERT INTO produto (nome, descricao, preco, estoque, imagem, categoria_id) VALUES (?, ?, ?, ?, ?, ?)", [nome, descricao, preco, estoque, imagem, categoria_id]);
        res.status(201).json({ message: "Produto criado com sucesso!", productId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota para atualizar um produto existente (apenas admin)
router.put("/:id", authenticateToken, authorizeAdmin, upload.single("imagem"), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, preco, estoque, categoria_id } = req.body;
        let imagem = req.file ? `/uploads/${req.file.filename}` : null;

        // Se uma nova imagem não for enviada, mantenha a imagem existente
        if (!imagem) {
            const [product] = await pool.query("SELECT imagem FROM produto WHERE id = ?", [id]);
            if (product.length > 0) {
                imagem = product[0].imagem;
            }
        }

        const [result] = await pool.query("UPDATE produto SET nome = ?, descricao = ?, preco = ?, estoque = ?, imagem = ?, categoria_id = ? WHERE id = ?", [nome, descricao, preco, estoque, imagem, categoria_id, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Produto não encontrado." });
        }
        res.json({ message: "Produto atualizado com sucesso!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota para desativar (soft delete) um produto (apenas admin)
router.delete("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query("UPDATE produto SET ativo = 0 WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Produto não encontrado." });
        }
        res.json({ message: "Produto desativado com sucesso!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

