const nodemailer = require('nodemailer');

/**
 * Envio opcional de e-mail por SMTP. As credenciais ficam SOMENTE em variáveis de ambiente:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Em testes (NODE_ENV=test) as mensagens ficam em memória em vez de serem enviadas.
 */
const enviadosEmTeste = [];
let transporte = null;

function configurado() {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.SMTP_HOST);
}

function obterTransporte() {
  if (transporte) return transporte;
  if (process.env.NODE_ENV === 'test') {
    transporte = nodemailer.createTransport({ jsonTransport: true });
  } else {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporte;
}

/** Envia (sem lançar erro): retorna true/false. */
async function enviar({ para, assunto, texto }) {
  if (!configurado() || !para || (Array.isArray(para) && para.length === 0)) return false;
  try {
    const remetente = process.env.SMTP_FROM || process.env.SMTP_USER || 'estoque@localhost';
    const info = await obterTransporte().sendMail({ from: remetente, to: para, subject: assunto, text: texto });
    if (process.env.NODE_ENV === 'test') enviadosEmTeste.push(JSON.parse(info.message));
    return true;
  } catch (erro) {
    console.error('[email] falha ao enviar:', erro.message);
    return false;
  }
}

module.exports = { enviar, configurado, enviadosEmTeste };
