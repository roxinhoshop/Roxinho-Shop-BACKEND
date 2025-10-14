const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

module.exports = (pool) => {
    // Rota de registro
    router.post("/register", async (req, res) => {
        try {
            const { nome, sobrenome, email, telefone, data_nascimento, senha } = req.body;
            
            // Verificar se o email já existe
            const [existingUsers] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
            if (existingUsers.length > 0) {
                return res.status(400).json({ 
                    success: false,
                    message: "Este e-mail já está cadastrado." 
                });
            }
            
            const hashedPassword = await bcrypt.hash(senha, 10);
            const nomeCompleto = `${nome} ${sobrenome}`;
            
            await pool.query(
                "INSERT INTO usuarios (nome, email, telefone, data_nascimento, senha, is_admin, verificado) VALUES (?, ?, ?, ?, ?, 0, 1)", 
                [nomeCompleto, email, telefone, data_nascimento, hashedPassword]
            );
            
            res.status(201).json({ 
                success: true,
                message: "Usuário registrado com sucesso!",
                redirect: "/login" // Indica para o frontend redirecionar para login
            });
        } catch (error) {
            console.error("Erro ao registrar usuário:", error);
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    });

    // Rota de login
    router.post("/login", async (req, res) => {
        try {
            const { email, senha } = req.body;
            const [users] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
            const user = users[0];
            
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: "Credenciais inválidas." 
                });
            }

            const isPasswordValid = await bcrypt.compare(senha, user.senha);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    success: false,
                    message: "Credenciais inválidas." 
                });
            }
            
            const token = jwt.sign({ 
                userId: user.id, 
                email: user.email, 
                isAdmin: user.is_admin 
            }, JWT_SECRET, { expiresIn: "24h" });
            
            // Extrair primeiro nome
            const primeiroNome = user.nome.split(' ')[0];
            
            res.json({ 
                success: true,
                token,
                user: {
                    id: user.id,
                    nome: primeiroNome, // Retorna apenas o primeiro nome
                    nomeCompleto: user.nome,
                    email: user.email,
                    isAdmin: user.is_admin,
                    telefone: user.telefone
                },
                redirect: "/" // Indica para o frontend redirecionar para página inicial
            });
        } catch (error) {
            console.error("Erro no login:", error);
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    });

    // Rota para verificar token e obter dados do usuário
    router.get("/verify", async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({ 
                    success: false,
                    message: "Token não fornecido" 
                });
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            const [users] = await pool.query("SELECT * FROM usuarios WHERE id = ?", [decoded.userId]);
            const user = users[0];
            
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: "Usuário não encontrado" 
                });
            }

            const primeiroNome = user.nome.split(' ')[0];
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    nome: primeiroNome,
                    nomeCompleto: user.nome,
                    email: user.email,
                    isAdmin: user.is_admin,
                    telefone: user.telefone
                }
            });
        } catch (error) {
            console.error("Erro na verificação do token:", error);
            res.status(401).json({ 
                success: false,
                message: "Token inválido" 
            });
        }
    });

    // Rota de verificação de e-mail (temporariamente desativada, mas mantida)
    router.get("/verify-email/:token", async (req, res) => {
        try {
            const { token } = req.params;
            const decoded = jwt.verify(token, JWT_SECRET);
            await pool.query("UPDATE usuarios SET verificado = 1, verification_token = NULL WHERE email = ?", [decoded.email]);
            res.send("E-mail verificado com sucesso!");
        } catch (error) {
            res.status(500).send("Link de verificação inválido ou expirado.");
        }
    });

    // Rota para listar todos os usuários (apenas admin)
    router.get("/users", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const [users] = await pool.query("SELECT id, nome, email, telefone, data_nascimento, is_admin, verificado FROM usuarios");
            res.json({
                success: true,
                users: users
            });
        } catch (error) {
            console.error("Erro ao listar usuários:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    return router;
};