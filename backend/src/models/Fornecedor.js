module.exports = (sequelize, DataTypes) => {
  const Fornecedor = sequelize.define(
    'Fornecedor',
    {
      nome: { type: DataTypes.STRING(150), allowNull: false },
      cnpj: { type: DataTypes.STRING(18), unique: true },
      telefone: { type: DataTypes.STRING(20) },
      email: { type: DataTypes.STRING(160) },
    },
    { tableName: 'fornecedores' }
  );

  Fornecedor.associate = (models) => {
    Fornecedor.hasMany(models.Movimentacao, { foreignKey: 'fornecedorId', as: 'movimentacoes' });
  };

  return Fornecedor;
};
