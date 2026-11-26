/** Encaminha erros de handlers assíncronos para o middleware central de erros. */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
