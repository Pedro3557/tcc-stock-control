module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'AlertaAtivo',
    {
      chave: { type: DataTypes.STRING(120), primaryKey: true },
      tipo: { type: DataTypes.STRING(40), allowNull: false },
    },
    { tableName: 'alertas_ativos', updatedAt: false }
  );
