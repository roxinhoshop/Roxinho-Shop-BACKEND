const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // Alterado para bcryptjs
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const { authenticateToken, authorizeAdmin } = require("../middleware/authMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

module.exports = (pool) => {
    // Rota de registro
    router.post("/register", async (req, res) => {
        try {
            const { nome, sobrenome, email, telefone, data_nascimento, senha } = req.body;
            
            // Verificar se o email já existe
            const [existingUsers] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
            if (existingUsers.length > 0) {
                return res.status(409).json({ // Alterado para 409 Conflict
                    success: false,
                    message: "Este e-mail já está cadastrado." 
                });
            }
            
            const hashedPassword = await bcrypt.hash(senha, 10);
            const nomeCompleto = `${nome} ${sobrenome}`;
            
            await pool.query(
                "INSERT INTO usuarios (nome, email, telefone, data_nascimento, senha, is_admin) VALUES (?, ?, ?, ?, ?, ?)", 
                [nomeCompleto, email, telefone, data_nascimento, hashedPassword, 0] // is_admin = 0 por padrão
            );
            
            const [newUser] = await pool.query("SELECT id, nome, email, is_admin FROM usuarios WHERE email = ?", [email]);
            const user = newUser[0];

            const token = jwt.sign({ 
                userId: user.id, 
                email: user.email, 
                isAdmin: user.is_admin, 
                nome: user.nome 
            }, JWT_SECRET, { expiresIn: "1h" }); // Token expira em 1 hora

            res.status(201).json({ 
                success: true,
                message: "Usuário registrado com sucesso!",
                token,
                usuario: { id: user.id, nome: user.nome, email: user.email, isAdmin: user.is_admin }
            });
        } catch (error) {
            console.error("Erro ao registrar usuário:", error);
            res.status(500).json({ 
                success: false,
                message: "Erro interno do servidor ao registrar usuário."
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
                    message: "E-mail ou senha incorretos." 
                });
            }

            const isPasswordValid = await bcrypt.compare(senha, user.senha);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    success: false,
                    message: "E-mail ou senha incorretos." 
                });
            }
            
            const token = jwt.sign({ 
                userId: user.id, 
                email: user.email, 
                isAdmin: user.is_admin, 
                nome: user.nome 
            }, JWT_SECRET, { expiresIn: "1h" }); // Token expira em 1 hora
            
            // Extrair primeiro nome
            const primeiroNome = user.nome.split(" ")[0];
            
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
                }
            });
        } catch (error) {
            console.error("Erro no login:", error);
            res.status(500).json({ 
                success: false,
                message: "Erro interno do servidor ao fazer login."
            });
        }
    });

    // Rota para verificar token e obter dados do usuário
    router.get("/verify", async (req, res) => {
        try {
            const token = req.headers.authorization?.replace("Bearer ", "");
            
            if (!token) {
                return res.status(401).json({ 
                    success: false,
                    message: "Token não fornecido" 
                });
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            const [users] = await pool.query("SELECT id, nome, email, is_admin, telefone FROM usuarios WHERE id = ?", [decoded.userId]);
            const user = users[0];
            
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: "Usuário não encontrado" 
                });
            }

            const primeiroNome = user.nome.split(" ")[0];
            
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
                message: "Token inválido ou expirado."
            });
        }
    });

    // Rota para listar todos os usuários (apenas admin)
    router.get("/users", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const [users] = await pool.query("SELECT id, nome, email, telefone, data_nascimento, is_admin FROM usuarios");
            res.json({
                success: true,
                users: users
            });
        } catch (error) {
            console.error("Erro ao listar usuários:", error);
            res.status(500).json({
                success: false,
                message: "Erro interno do servidor ao listar usuários."
            });
        }
    });

    return router;
};
