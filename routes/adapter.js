/**
 * Adaptador para padronizar respostas da API
 * Converte respostas simples para o formato esperado pelo front-end
 */

function adaptResponse(data, type = 'default') {
    // Se já está no formato correto, retorna como está
    if (data && data.status) {
        return data;
    }

    // Adaptar diferentes tipos de resposta
    switch (type) {
        case 'list':
            // Para listas (arrays)
            if (Array.isArray(data)) {
                return {
                    status: 'success',
                    [getDataKey(data)]: data,
                    count: data.length
                };
            }
            break;
        
        case 'single':
            // Para objetos únicos
            if (typeof data === 'object' && !Array.isArray(data)) {
                return {
                    status: 'success',
                    [getDataKey([data])]: data
                };
            }
            break;
        
        case 'message':
            // Para mensagens simples
            return {
                status: 'success',
                message: data
            };
    }

    // Retorno padrão
    return {
        status: 'success',
        data: data
    };
}

function getDataKey(data) {
    // Tentar inferir a chave baseado no primeiro item
    if (data && data.length > 0 && data[0]) {
        if (data[0].nome && data[0].slug) return 'categories';
        if (data[0].preco) return 'products';
        if (data[0].email) return 'users';
    }
    return 'data';
}

module.exports = { adaptResponse };

