'use strict';

const STATUS = ['em_estoque', 'com_tecnico', 'instalado_cliente', 'em_manutencao', 'defeito', 'baixado'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const fk = (tabela, allowNull = true) => ({
      type: Sequelize.INTEGER,
      allowNull,
      references: { model: tabela, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.createTable('movimentacoes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      produtoId: fk('produtos', false),
      equipamentoId: fk('equipamentos'),
      usuarioId: fk('usuarios', false),
      tecnicoId: fk('tecnicos'),
      fornecedorId: fk('fornecedores'),
      tipo: {
        type: Sequelize.ENUM(
          'entrada_compra',
          'saida_tecnico',
          'devolucao_tecnico',
          'instalacao_cliente',
          'retirada_cliente',
          'envio_manutencao',
          'retorno_manutencao',
          'baixa',
          'ajuste_inventario'
        ),
        allowNull: false,
      },
      quantidade: { type: Sequelize.DECIMAL(12, 3), allowNull: false },
      clienteCodigo: { type: Sequelize.STRING(40), allowNull: true },
      numeroOS: { type: Sequelize.STRING(40), allowNull: true },
      notaFiscal: { type: Sequelize.STRING(60), allowNull: true },
      observacao: { type: Sequelize.TEXT, allowNull: true },
      statusAnterior: { type: Sequelize.ENUM(...STATUS), allowNull: true },
      statusNovo: { type: Sequelize.ENUM(...STATUS), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('movimentacoes', ['createdAt']);
    await queryInterface.addIndex('movimentacoes', ['tipo']);
    await queryInterface.addIndex('movimentacoes', ['clienteCodigo']);
    await queryInterface.addIndex('movimentacoes', ['numeroOS']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('movimentacoes');
  },
};
