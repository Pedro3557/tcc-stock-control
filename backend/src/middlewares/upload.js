const multer = require('multer');
const AppError = require('../utils/AppError');

const TIPOS_XLSX = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // alguns navegadores/sistemas enviam assim
];

/** Recebe uma planilha .xlsx em memória (até 5 MB) no campo "arquivo". */
const receberPlanilha = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const nomeOk = /\.xlsx$/i.test(file.originalname);
    if (!nomeOk || !TIPOS_XLSX.includes(file.mimetype)) {
      return cb(new AppError('Envie uma planilha do Excel no formato .xlsx (salve como "Pasta de Trabalho do Excel").'));
    }
    return cb(null, true);
  },
}).single('arquivo');

/** Converte os erros do multer em mensagens em português. */
function uploadPlanilha(req, res, next) {
  receberPlanilha(req, res, (erro) => {
    if (!erro) return next();
    if (erro instanceof multer.MulterError) {
      const mensagem = erro.code === 'LIMIT_FILE_SIZE' ? 'A planilha passa de 5 MB.' : 'Envie apenas um arquivo, no campo "arquivo".';
      return next(new AppError(mensagem));
    }
    return next(erro);
  });
}

module.exports = { uploadPlanilha };
