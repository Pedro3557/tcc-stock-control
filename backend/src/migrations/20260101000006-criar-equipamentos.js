'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipamentos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      produtoId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'produtos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      numeroSerie: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      mac: { type: Sequelize.STRING(17), allowNull: true, unique: true },
      status: {
        type: Sequelize.ENUM('em_estoque', 'com_tecnico', 'instalado_cliente', 'em_manutencao', 'defeito', 'baixado'),
        allowNull: false,
        defaultValue: 'em_estoque',
      },
      tecnicoId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'tecnicos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      clienteCodigo: { type: Sequelize.STRING(40), allowNull: true },
      clienteNome: { type: Sequelize.STRING(150), allowNull: true },
      observacao: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('equipamentos', ['status']);
    await queryInterface.addIndex('equipamentos', ['clienteCodigo']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('equipamentos');
  },
};
