'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('fornecedores', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      nome: { type: Sequelize.STRING(150), allowNull: false },
      cnpj: { type: Sequelize.STRING(18), unique: true },
      telefone: { type: Sequelize.STRING(20) },
      email: { type: Sequelize.STRING(160) },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('fornecedores');
  },
};
