'use strict';

// Adiciona a flag "precisaTrocarSenha" em usuarios. Contas criadas pelo admin
// (ou com senha redefinida por ele) precisam trocar a senha no primeiro acesso.
const EMAILS_SEED = ['admin@provedor.com', 'almoxarife@provedor.com', 'consulta@provedor.com'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuarios', 'precisaTrocarSenha', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'perfil',
    });
    // Instalações existentes: usuários do seed ainda usam senhas documentadas no README
    await queryInterface.bulkUpdate('usuarios', { precisaTrocarSenha: true }, { email: EMAILS_SEED });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('usuarios', 'precisaTrocarSenha');
  },
};
