'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('produtos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      categoriaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'categorias', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      codigo: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      nome: { type: Sequelize.STRING(150), allowNull: false },
      marca: { type: Sequelize.STRING(80) },
      modelo: { type: Sequelize.STRING(80) },
      tipoControle: { type: Sequelize.ENUM('serializado', 'quantidade'), allowNull: false },
      unidade: { type: Sequelize.ENUM('un', 'm', 'cx', 'pct', 'rolo'), allowNull: false, defaultValue: 'un' },
      local: { type: Sequelize.STRING(60) },
      estoqueMinimo: { type: Sequelize.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
      custoUnitario: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      quantidade: { type: Sequelize.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
      ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('produtos', ['nome']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('produtos');
  },
};
