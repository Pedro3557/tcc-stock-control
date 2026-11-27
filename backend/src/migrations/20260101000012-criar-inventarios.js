'use strict';

/**
 * Inventário físico:
 * - inventarios: a sessão (escopo, situação, quem criou/aprovou)
 * - inventario_itens: um produto conferido (saldo do sistema no início x quantidade contada)
 * - inventario_equipamentos: unidades serializadas esperadas e/ou lidas na conferência
 * O estoque só muda quando um administrador aprova os ajustes.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const fk = (tabela, allowNull = true, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER,
      allowNull,
      references: { model: tabela, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    await queryInterface.createTable('inventarios', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      descricao: { type: Sequelize.STRING(150), allowNull: false },
      situacao: {
        type: Sequelize.ENUM('em_contagem', 'em_revisao', 'concluido', 'cancelado'),
        allowNull: false,
        defaultValue: 'em_contagem',
      },
      escopo: { type: Sequelize.JSON, allowNull: true },
      observacao: { type: Sequelize.TEXT, allowNull: true },
      criadoPor: fk('usuarios', false),
      finalizadoPor: fk('usuarios'),
      finalizadoEm: { type: Sequelize.DATE, allowNull: true },
      aprovadoPor: fk('usuarios'),
      aprovadoEm: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('inventarios', ['situacao']);

    await queryInterface.createTable('inventario_itens', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      inventarioId: fk('inventarios', false, 'CASCADE'),
      produtoId: fk('produtos', false),
      quantidadeSistema: { type: Sequelize.DECIMAL(12, 3), allowNull: false },
      quantidadeContada: { type: Sequelize.DECIMAL(12, 3), allowNull: true },
      acao: { type: Sequelize.ENUM('pendente', 'ajustar', 'manter'), allowNull: false, defaultValue: 'pendente' },
      justificativa: { type: Sequelize.TEXT, allowNull: true },
      movimentacaoId: fk('movimentacoes'),
      contadoPor: fk('usuarios'),
      contadoEm: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('inventario_itens', ['inventarioId', 'produtoId'], { unique: true, name: 'inventario_item_unico' });

    await queryInterface.createTable('inventario_equipamentos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      inventarioId: fk('inventarios', false, 'CASCADE'),
      equipamentoId: fk('equipamentos', false),
      statusSistema: {
        type: Sequelize.ENUM('em_estoque', 'com_tecnico', 'instalado_cliente', 'em_manutencao', 'defeito', 'baixado'),
        allowNull: false,
      },
      esperado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      encontrado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      lidoPor: fk('usuarios'),
      lidoEm: { type: Sequelize.DATE, allowNull: true },
      acao: { type: Sequelize.ENUM('pendente', 'ajustar', 'manter'), allowNull: false, defaultValue: 'pendente' },
      statusAjuste: {
        type: Sequelize.ENUM('em_estoque', 'em_manutencao', 'defeito', 'baixado'),
        allowNull: true,
      },
      justificativa: { type: Sequelize.TEXT, allowNull: true },
      movimentacaoId: fk('movimentacoes'),
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('inventario_equipamentos', ['inventarioId', 'equipamentoId'], { unique: true, name: 'inventario_equipamento_unico' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inventario_equipamentos');
    await queryInterface.dropTable('inventario_itens');
    await queryInterface.dropTable('inventarios');
  },
};
