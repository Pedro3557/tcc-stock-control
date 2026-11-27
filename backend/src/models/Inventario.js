module.exports = (sequelize, DataTypes) => {
  const Inventario = sequelize.define(
    'Inventario',
    {
      descricao: { type: DataTypes.STRING(150), allowNull: false },
      situacao: {
        type: DataTypes.ENUM('em_contagem', 'em_revisao', 'concluido', 'cancelado'),
        allowNull: false,
        defaultValue: 'em_contagem',
      },
      escopo: { type: DataTypes.JSON, allowNull: true },
      observacao: { type: DataTypes.TEXT, allowNull: true },
      criadoPor: { type: DataTypes.INTEGER, allowNull: false },
      finalizadoPor: { type: DataTypes.INTEGER, allowNull: true },
      finalizadoEm: { type: DataTypes.DATE, allowNull: true },
      aprovadoPor: { type: DataTypes.INTEGER, allowNull: true },
      aprovadoEm: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'inventarios' }
  );

  Inventario.associate = (models) => {
    Inventario.hasMany(models.InventarioItem, { foreignKey: 'inventarioId', as: 'itens' });
    Inventario.hasMany(models.InventarioEquipamento, { foreignKey: 'inventarioId', as: 'equipamentos' });
    Inventario.belongsTo(models.Usuario, { foreignKey: 'criadoPor', as: 'criador' });
    Inventario.belongsTo(models.Usuario, { foreignKey: 'finalizadoPor', as: 'finalizador' });
    Inventario.belongsTo(models.Usuario, { foreignKey: 'aprovadoPor', as: 'aprovador' });
  };
  return Inventario;
};
