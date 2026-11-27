'use strict';

/**
 * - notificacoes: mensagens da central de notificações (uma por destinatário)
 * - alertas_ativos: situações em alerta no momento (ex.: produto abaixo do mínimo).
 *   Enquanto a chave existir, a mesma situação não gera nova notificação; ao normalizar, a chave é removida.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notificacoes', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
      usuarioId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: { type: Sequelize.STRING(40), allowNull: false },
      nivel: { type: Sequelize.ENUM('info', 'aviso', 'critico'), allowNull: false, defaultValue: 'aviso' },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      mensagem: { type: Sequelize.TEXT, allowNull: false },
      link: { type: Sequelize.STRING(200), allowNull: true },
      chave: { type: Sequelize.STRING(120), allowNull: true },
      lida: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      lidaEm: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('notificacoes', ['usuarioId', 'lida']);
    await queryInterface.addIndex('notificacoes', ['createdAt']);

    await queryInterface.createTable('alertas_ativos', {
      chave: { type: Sequelize.STRING(120), primaryKey: true, allowNull: false },
      tipo: { type: Sequelize.STRING(40), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('alertas_ativos');
    await queryInterface.dropTable('notificacoes');
  },
};
