// Configurações globais da aplicação
// Este arquivo centraliza todas as configurações do backend

const config = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || '*',
    apiBaseUrl: process.env.API_BASE_URL || ''
  },
  
  // Configurações do banco de dados
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000
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
    base: '/api',
    auth: '/api/auth',
    products: '/api/products',
    categories: '/api/categories',
    reviews: '/api/reviews',
    historico: '/api/historico',
    productImages: '/api/product-images',
    productScraper: '/api/product-scraper',
    adapter: '/api/adapter',
    upload: '/api/upload'
  }
};

module.exports = config;