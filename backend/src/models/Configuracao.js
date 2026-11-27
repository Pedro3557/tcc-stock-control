module.exports = (sequelize, DataTypes) => {
  const Configuracao = sequelize.define(
    'Configuracao',
    {
      chave: { type: DataTypes.STRING(80), primaryKey: true },
      valor: { type: DataTypes.TEXT, allowNull: true },
      atualizadoPor: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'configuracoes', createdAt: false }
  );
  return Configuracao;
};
