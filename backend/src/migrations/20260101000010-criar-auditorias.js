'use strict';

// Registro de auditoria: somente inserção (a aplicação não oferece edição nem exclusão).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auditorias', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
      usuarioId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Nome guardado no momento da operação (o histórico não muda se o usuário for renomeado)
      usuarioNome: { type: Sequelize.STRING(120), allowNull: true },
      acao: { type: Sequelize.STRING(40), allowNull: false },
      modulo: { type: Sequelize.STRING(40), allowNull: false },
      registroId: { type: Sequelize.STRING(60), allowNull: true },
      dadosAnteriores: { type: Sequelize.JSON, allowNull: true },
      dadosPosteriores: { type: Sequelize.JSON, allowNull: true },
      resultado: { type: Sequelize.ENUM('sucesso', 'falha'), allowNull: false, defaultValue: 'sucesso' },
      detalhe: { type: Sequelize.STRING(500), allowNull: true },
      ip: { type: Sequelize.STRING(45), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('auditorias', ['createdAt']);
    await queryInterface.addIndex('auditorias', ['modulo', 'acao']);
    await queryInterface.addIndex('auditorias', ['modulo', 'registroId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('auditorias');
  },
};
