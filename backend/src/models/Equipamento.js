const { STATUS_EQUIPAMENTO } = require('../config/constantes');

module.exports = (sequelize, DataTypes) => {
  const Equipamento = sequelize.define(
    'Equipamento',
    {
      produtoId: { type: DataTypes.INTEGER, allowNull: false },
      numeroSerie: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      mac: { type: DataTypes.STRING(17), allowNull: true, unique: true },
      status: { type: DataTypes.ENUM(...STATUS_EQUIPAMENTO), allowNull: false, defaultValue: 'em_estoque' },
      tecnicoId: { type: DataTypes.INTEGER, allowNull: true },
      clienteCodigo: { type: DataTypes.STRING(40), allowNull: true },
      clienteNome: { type: DataTypes.STRING(150), allowNull: true },
      observacao: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'equipamentos' }
  );

  Equipamento.associate = (models) => {
    Equipamento.belongsTo(models.Produto, { foreignKey: 'produtoId', as: 'produto' });
    Equipamento.belongsTo(models.Tecnico, { foreignKey: 'tecnicoId', as: 'tecnico' });
    Equipamento.hasMany(models.Movimentacao, { foreignKey: 'equipamentoId', as: 'movimentacoes' });
  };

  return Equipamento;
};
