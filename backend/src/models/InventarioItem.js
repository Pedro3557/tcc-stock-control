module.exports = (sequelize, DataTypes) => {
  const InventarioItem = sequelize.define(
    'InventarioItem',
    {
      inventarioId: { type: DataTypes.INTEGER, allowNull: false },
      produtoId: { type: DataTypes.INTEGER, allowNull: false },
      quantidadeSistema: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      quantidadeContada: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      acao: { type: DataTypes.ENUM('pendente', 'ajustar', 'manter'), allowNull: false, defaultValue: 'pendente' },
      justificativa: { type: DataTypes.TEXT, allowNull: true },
      movimentacaoId: { type: DataTypes.INTEGER, allowNull: true },
      contadoPor: { type: DataTypes.INTEGER, allowNull: true },
      contadoEm: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'inventario_itens' }
  );

  InventarioItem.associate = (models) => {
    InventarioItem.belongsTo(models.Inventario, { foreignKey: 'inventarioId', as: 'inventario' });
    InventarioItem.belongsTo(models.Produto, { foreignKey: 'produtoId', as: 'produto' });
    InventarioItem.belongsTo(models.Usuario, { foreignKey: 'contadoPor', as: 'contador' });
  };
  return InventarioItem;
};
