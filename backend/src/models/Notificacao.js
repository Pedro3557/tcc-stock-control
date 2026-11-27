module.exports = (sequelize, DataTypes) => {
  const Notificacao = sequelize.define(
    'Notificacao',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      usuarioId: { type: DataTypes.INTEGER, allowNull: false },
      tipo: { type: DataTypes.STRING(40), allowNull: false },
      nivel: { type: DataTypes.ENUM('info', 'aviso', 'critico'), allowNull: false, defaultValue: 'aviso' },
      titulo: { type: DataTypes.STRING(160), allowNull: false },
      mensagem: { type: DataTypes.TEXT, allowNull: false },
      link: { type: DataTypes.STRING(200), allowNull: true },
      chave: { type: DataTypes.STRING(120), allowNull: true },
      lida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lidaEm: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'notificacoes', updatedAt: false }
  );
  Notificacao.associate = (models) => {
    Notificacao.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
  };
  return Notificacao;
};
