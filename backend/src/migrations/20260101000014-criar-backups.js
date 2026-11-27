'use strict';

// Histórico de backups do banco (os arquivos ficam na pasta configurada em BACKUP_DIR).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('backups', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      arquivo: { type: Sequelize.STRING(120), allowNull: true },
      origem: { type: Sequelize.ENUM('automatico', 'manual', 'pre_restauracao'), allowNull: false },
      situacao: { type: Sequelize.ENUM('em_andamento', 'sucesso', 'falha', 'removido'), allowNull: false },
      tamanho: { type: Sequelize.BIGINT, allowNull: true },
      sha256: { type: Sequelize.STRING(64), allowNull: true },
      tabelas: { type: Sequelize.INTEGER, allowNull: true },
      registros: { type: Sequelize.INTEGER, allowNull: true },
      erro: { type: Sequelize.STRING(500), allowNull: true },
      usuarioId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      iniciadoEm: { type: Sequelize.DATE, allowNull: false },
      concluidoEm: { type: Sequelize.DATE, allowNull: true },
      restauradoEm: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('backups', ['iniciadoEm']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('backups');
  },
};
