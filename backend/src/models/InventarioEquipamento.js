const { STATUS_EQUIPAMENTO } = require('../config/constantes');

module.exports = (sequelize, DataTypes) => {
  const InventarioEquipamento = sequelize.define(
    'InventarioEquipamento',
    {
      inventarioId: { type: DataTypes.INTEGER, allowNull: false },
      equipamentoId: { type: DataTypes.INTEGER, allowNull: false },
      statusSistema: { type: DataTypes.ENUM(...STATUS_EQUIPAMENTO), allowNull: false },
      // esperado = deveria estar fisicamente no almoxarifado (em estoque ou com defeito)
      esperado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      encontrado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lidoPor: { type: DataTypes.INTEGER, allowNull: true },
      lidoEm: { type: DataTypes.DATE, allowNull: true },
      acao: { type: DataTypes.ENUM('pendente', 'ajustar', 'manter'), allowNull: false, defaultValue: 'pendente' },
      statusAjuste: { type: DataTypes.ENUM('em_estoque', 'em_manutencao', 'defeito', 'baixado'), allowNull: true },
      justificativa: { type: DataTypes.TEXT, allowNull: true },
      movimentacaoId: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'inventario_equipamentos' }
  );

  InventarioEquipamento.associate = (models) => {
    InventarioEquipamento.belongsTo(models.Inventario, { foreignKey: 'inventarioId', as: 'inventario' });
    InventarioEquipamento.belongsTo(models.Equipamento, { foreignKey: 'equipamentoId', as: 'equipamento' });
    InventarioEquipamento.belongsTo(models.Usuario, { foreignKey: 'lidoPor', as: 'leitor' });
  };
  return InventarioEquipamento;
};
