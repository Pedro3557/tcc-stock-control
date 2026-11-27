'use strict';

// Configurações gerais do sistema (organização, backup, notificações), editáveis pelo administrador.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('configuracoes', {
      chave: { type: Sequelize.STRING(80), primaryKey: true, allowNull: false },
      valor: { type: Sequelize.TEXT, allowNull: true },
      atualizadoPor: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('configuracoes');
  },
};
