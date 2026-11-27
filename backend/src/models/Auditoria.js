module.exports = (sequelize, DataTypes) => {
  const Auditoria = sequelize.define(
    'Auditoria',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      usuarioId: { type: DataTypes.INTEGER, allowNull: true },
      usuarioNome: { type: DataTypes.STRING(120), allowNull: true },
      acao: { type: DataTypes.STRING(40), allowNull: false },
      modulo: { type: DataTypes.STRING(40), allowNull: false },
      registroId: { type: DataTypes.STRING(60), allowNull: true },
      dadosAnteriores: { type: DataTypes.JSON, allowNull: true },
      dadosPosteriores: { type: DataTypes.JSON, allowNull: true },
      resultado: { type: DataTypes.ENUM('sucesso', 'falha'), allowNull: false, defaultValue: 'sucesso' },
      detalhe: { type: DataTypes.STRING(500), allowNull: true },
      ip: { type: DataTypes.STRING(45), allowNull: true },
    },
    { tableName: 'auditorias', updatedAt: false }
  );

  // Registros de auditoria são imutáveis
  const bloquear = () => {
    throw new Error('Registros de auditoria não podem ser alterados ou excluídos.');
  };
  Auditoria.addHook('beforeUpdate', bloquear);
  Auditoria.addHook('beforeDestroy', bloquear);
  Auditoria.addHook('beforeBulkUpdate', bloquear);
  Auditoria.addHook('beforeBulkDestroy', bloquear);

  Auditoria.associate = (models) => {
    Auditoria.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
  };
  return Auditoria;
};
