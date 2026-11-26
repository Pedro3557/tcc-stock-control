const { TIPOS_CONTROLE, UNIDADES } = require('../config/constantes');

module.exports = (sequelize, DataTypes) => {
  const Produto = sequelize.define(
    'Produto',
    {
      categoriaId: { type: DataTypes.INTEGER, allowNull: false },
      codigo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      nome: { type: DataTypes.STRING(150), allowNull: false },
      marca: { type: DataTypes.STRING(80) },
      modelo: { type: DataTypes.STRING(80) },
      tipoControle: { type: DataTypes.ENUM(...TIPOS_CONTROLE), allowNull: false },
      unidade: { type: DataTypes.ENUM(...UNIDADES), allowNull: false, defaultValue: 'un' },
      local: { type: DataTypes.STRING(60) },
      estoqueMinimo: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
      custoUnitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      quantidade: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
      ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'produtos' }
  );

  Produto.associate = (models) => {
    Produto.belongsTo(models.Categoria, { foreignKey: 'categoriaId', as: 'categoria' });
    Produto.hasMany(models.Equipamento, { foreignKey: 'produtoId', as: 'equipamentos' });
    Produto.hasMany(models.Movimentacao, { foreignKey: 'produtoId', as: 'movimentacoes' });
  };

  return Produto;
};
