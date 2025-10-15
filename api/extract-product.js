/**
 * Vercel Serverless Function
 * Endpoint: /api/product-scraper/extract-from-url
 */

const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'switchback.proxy.rlwy.net',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 46156,
    waitForConnections: true,
    connectionLimit: 10
};

let pool;

function getPool() {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
}

/**
 * Detecta categoria automaticamente baseada no nome do produto
 */
async function detectCategory(productName) {
    try {
        const name = productName.toLowerCase();
        
        // Mapeamento de palavras-chave para categorias
        const categoryMap = {
            2: ['mouse', 'teclado', 'headset', 'fone', 'webcam', 'microfone'],
            1: ['processador', 'placa de vídeo', 'memória ram', 'ssd', 'hd', 'fonte'],
            3: ['notebook', 'desktop', 'pc', 'computador', 'all in one'],
            4: ['console', 'playstation', 'xbox', 'nintendo', 'controle', 'joystick'],
            5: ['celular', 'smartphone', 'iphone', 'galaxy', 'xiaomi'],
            6: ['tv', 'televisão', 'smart tv', 'soundbar', 'home theater'],
            7: ['caixa de som', 'alto-falante', 'speaker', 'jbl'],
            8: ['cadeira gamer', 'mesa gamer', 'suporte monitor'],
            9: ['alexa', 'google home', 'lâmpada inteligente', 'tomada inteligente'],
            10: ['carregador', 'bateria', 'power bank', 'fonte de alimentação']
        };
        
        // Buscar categoria por palavra-chave
        for (const [catId, keywords] of Object.entries(categoryMap)) {
            for (const keyword of keywords) {
                if (name.includes(keyword)) {
                    return parseInt(catId);
                }
            }
        }
        
        // Categoria padrão: Periféricos
        return 2;
        
    } catch (error) {
        console.error('Erro ao detectar categoria:', error);
        return 2;
    }
}

/**
 * Extrai dados de um produto do Mercado Livre
 */
async function extractFromMercadoLivre(url) {
    try {
        // Extrair ID do produto da URL
        const mlbMatch = url.match(/MLB-?(\d+)/i);
        if (!mlbMatch) {
            throw new Error('ID do produto não encontrado na URL');
        }
        
        const productId = mlbMatch[0].replace('-', '');
        const apiUrl = `https://api.mercadolibre.com/items/${productId}`;
        
        // Fazer requisição à API do Mercado Livre
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Produto não encontrado no Mercado Livre');
        }
        
        const data = await response.json();
        
        // Detectar categoria automaticamente
        const categoria_id = await detectCategory(data.title);
        
        // Extrair dados relevantes
        return {
            nome: data.title,
            preco: data.price,
            descricao: data.plain_text || data.subtitle || '',
            imagem: data.thumbnail || data.pictures?.[0]?.url || data.secure_thumbnail,
            galeria_imagens: JSON.stringify(data.pictures?.map(p => p.url) || []),
            marca: data.attributes?.find(a => a.id === 'BRAND')?.value_name || null,
            modelo: data.attributes?.find(a => a.id === 'MODEL')?.value_name || null,
            estoque: data.available_quantity || 0,
            categoria_id: categoria_id,
            link_mercado_livre: url,
            preco_mercado_livre: data.price,
            ativo: 1
        };
        
    } catch (error) {
        console.error('Erro ao extrair do Mercado Livre:', error);
        throw error;
    }
}

/**
 * Handler principal da função serverless
 */
module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Responder OPTIONS para preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Apenas POST é permitido
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Método não permitido'
        });
    }
    
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL é obrigatória'
            });
        }
        
        // Detectar plataforma
        let platform = null;
        if (url.includes('mercadolivre.com.br') || url.includes('mercadolibre.com')) {
            platform = 'mercadolivre';
        } else if (url.includes('amazon.com.br') || url.includes('amazon.com')) {
            platform = 'amazon';
        } else {
            return res.status(400).json({
                success: false,
                message: 'URL não suportada. Use links do Mercado Livre ou Amazon.'
            });
        }
        
        // Extrair dados baseado na plataforma
        let productData;
        if (platform === 'mercadolivre') {
            productData = await extractFromMercadoLivre(url);
        } else if (platform === 'amazon') {
                productData = await extractFromAmazon(url);
        }
        
        if (!productData) {
            return res.status(500).json({
                success: false,
                message: 'Não foi possível extrair dados do produto'
            });
        }
        
        res.status(200).json({
            success: true,
            product: productData,
            platform: platform
        });
        
    } catch (error) {
        console.error('Erro ao extrair dados do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar a URL',
            error: error.message
        });
    }
};




/**
 * Extrai dados de um produto da Amazon usando scraping básico
 */
async function extractFromAmazon(url) {
    try {
        const { data } = await axios.get(url, {
            timeout: 10000, // Adicionar um timeout para evitar requisições penduradas

            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        const $ = cheerio.load(data);

        const productName = $("#productTitle").text().trim() || $("h1 span#title").text().trim() || $("meta[name=\"title\"]").attr("content") || $("meta[property=\"og:title\"]").attr("content");
        
        let price = 0.00;
        const priceSelectors = [
            "span.a-price span.a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            "#kindle-price",
            ".a-color-price"
        ];

        for (const selector of priceSelectors) {
            const priceText = $(selector).text().trim();
            if (priceText) {
                price = parseFloat(priceText.replace(/[^0-9,.]/g, "").replace(",", "."));
                if (!isNaN(price) && price > 0) break;
            }
        }

        const description = $("#productDescription p").first().text().trim() || $("#feature-bullets ul").text().trim() || $("meta[name=\"description\"]").attr("content") || $("meta[property=\"og:description\"]").attr("content");
        const imageUrl = $("#landingImage").attr("src") || $("#imgTagWrapperId img").attr("src") || $("meta[property=\"og:image\"]").attr("content") || $("meta[name=\"twitter:image\"]").attr("content");

        const categoria_id = await detectCategory(productName, null, pool);

        return {
            nome: productName || "Nome do Produto Amazon Desconhecido",
            preco: price || 0.00,
            descricao: description || "Descrição não disponível.",
            imagem: imageUrl || "https://via.placeholder.com/400?text=Amazon+Product",
            galeria_imagens: JSON.stringify(imageUrl ? [imageUrl] : []),
            marca: null,
            modelo: null,
            estoque: 0,
            categoria_id: categoria_id,
            link_amazon: url,
            preco_amazon: price || 0.00,
            ativo: 1
        };

    } catch (error) {
        console.error("Erro ao extrair da Amazon:", error.message, error.response?.status, error.response?.data);
        throw error;
    }
}
