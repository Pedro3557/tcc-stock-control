/**
 * Redefine a senha de um usuário pela linha de comando (ex.: esqueceu a senha do único admin).
 * Uso: npm run redefinir-senha -- admin@provedor.com NovaSenha123
 * A senha vira provisória: o usuário precisa trocá-la no próximo login.
 */
const bcrypt = require('bcryptjs');
const { Usuario, sequelize } = require('../src/models');

async function main() {
  const [email, senha] = process.argv.slice(2);
  if (!email || !senha) {
    console.error('Uso: npm run redefinir-senha -- <email> <nova-senha>');
    process.exit(1);
  }
  if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    console.error('A senha deve ter pelo menos 8 caracteres, com letras e números.');
    process.exit(1);
  }
  const usuario = await Usuario.findOne({ where: { email: email.trim().toLowerCase() } });
  if (!usuario) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }
  await usuario.update({ senhaHash: await bcrypt.hash(senha, 10), precisaTrocarSenha: true, ativo: true, senhaAlteradaEm: new Date(Math.floor(Date.now() / 1000) * 1000) });
  console.log(`Senha de ${usuario.email} redefinida. Ela deverá ser trocada no próximo login.`);
  await sequelize.close();
}

main().catch((erro) => {
  console.error('Erro:', erro.message);
  process.exit(1);
});
