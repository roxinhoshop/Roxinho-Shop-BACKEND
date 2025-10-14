const multer = require('multer');
const path = require('path');
const config = require('../config');

// Configuração do multer com limite definido no config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.upload.uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro para tipos de arquivo permitidos
const fileFilter = (req, file, cb) => {
    // Usar os tipos permitidos do config
    const isAllowedType = config.upload.allowedFileTypes.includes(file.mimetype);
    const extname = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());

    if (isAllowedType && extname) {
        return cb(null, true);
    } else {
        cb(new Error(`Apenas imagens são permitidas (${config.upload.allowedFileTypes.map(type => type.split('/')[1]).join(', ')})`));
    }
};

// Configuração do multer com limite do config
const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.upload.maxFileSize, // Limite definido no config
        files: 10 // Máximo 10 arquivos por upload
    },
    fileFilter: fileFilter
});

// Middleware de tratamento de erros de upload
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Arquivo muito grande. O limite é de 50MB por arquivo.',
                code: 'FILE_TOO_LARGE'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Muitos arquivos. O limite é de 10 arquivos por upload.',
                code: 'TOO_MANY_FILES'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'Campo de arquivo inesperado.',
                code: 'UNEXPECTED_FIELD'
            });
        }
    }
    
    if (error.message.includes('Apenas imagens são permitidas')) {
        return res.status(400).json({
            success: false,
            error: error.message,
            code: 'INVALID_FILE_TYPE'
        });
    }

    return res.status(500).json({
        success: false,
        error: 'Erro interno no upload do arquivo.',
        code: 'UPLOAD_ERROR'
    });
};

module.exports = {
    upload,
    handleUploadError
};