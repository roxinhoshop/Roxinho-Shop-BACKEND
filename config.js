// Configurações globais da aplicação
// Este arquivo centraliza todas as configurações do backend

const config = {

  // Configurações do servidor
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'https://roxinho-shop.vercel.app',
    apiBaseUrl: process.env.API_BASE_URL || '/api'
  },
  
  // Configurações do banco de dados
  database: {
    host: process.env.DB_HOST || "switchback.proxy.rlwy.net",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "neFMagcBhfWUyBoRNMCBBTCZsTeyeBja",
    name: process.env.DB_NAME || "railway",
    port: process.env.DB_PORT || 3306,
    connectionLimit: 10,
    queueLimit: 0,

  },
  
  // Configurações de autenticação
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'roxinho-shop-secret-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '7d',
    saltRounds: 10
  },
  
  // Configurações de upload
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB em bytes
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    uploadDir: 'uploads'
  },
  
  // Endpoints da API
  endpoints: {
    base: '',
    auth: '/auth',
    products: '/produtos',
    categories: '/categorias',
    reviews: '/reviews',
    historico: '/historico',
    productImages: '/product-images',
    productScraper: '/product-scraper',
    adapter: '/adapter',
    upload: '/upload'
  }
};

module.exports = config;