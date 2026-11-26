const { TIPOS_MOVIMENTACAO, STATUS_EQUIPAMENTO } = require('../config/constantes');

module.exports = (sequelize, DataTypes) => {
  const Movimentacao = sequelize.define(
    'Movimentacao',
    {
      produtoId: { type: DataTypes.INTEGER, allowNull: false },
      equipamentoId: { type: DataTypes.INTEGER, allowNull: true },
      usuarioId: { type: DataTypes.INTEGER, allowNull: false },
      tecnicoId: { type: DataTypes.INTEGER, allowNull: true },
      fornecedorId: { type: DataTypes.INTEGER, allowNull: true },
      tipo: { type: DataTypes.ENUM(...TIPOS_MOVIMENTACAO), allowNull: false },
      // Positiva na maioria dos tipos; no ajuste de inventário guarda a diferença (pode ser negativa)
      quantidade: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      clienteCodigo: { type: DataTypes.STRING(40), allowNull: true },
      numeroOS: { type: DataTypes.STRING(40), allowNull: true },
      notaFiscal: { type: DataTypes.STRING(60), allowNull: true },
      observacao: { type: DataTypes.TEXT, allowNull: true },
      // Para equipamentos: status antes e depois do movimento (facilita o histórico da unidade)
      statusAnterior: { type: DataTypes.ENUM(...STATUS_EQUIPAMENTO), allowNull: true },
      statusNovo: { type: DataTypes.ENUM(...STATUS_EQUIPAMENTO), allowNull: true },
    },
    { tableName: 'movimentacoes', updatedAt: false }
  );

  Movimentacao.associate = (models) => {
    Movimentacao.belongsTo(models.Produto, { foreignKey: 'produtoId', as: 'produto' });
    Movimentacao.belongsTo(models.Equipamento, { foreignKey: 'equipamentoId', as: 'equipamento' });
    Movimentacao.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
    Movimentacao.belongsTo(models.Tecnico, { foreignKey: 'tecnicoId', as: 'tecnico' });
    Movimentacao.belongsTo(models.Fornecedor, { foreignKey: 'fornecedorId', as: 'fornecedor' });
  };

  return Movimentacao;
};
