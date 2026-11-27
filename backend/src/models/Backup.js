module.exports = (sequelize, DataTypes) => {
  const Backup = sequelize.define(
    'Backup',
    {
      arquivo: { type: DataTypes.STRING(120), allowNull: true },
      origem: { type: DataTypes.ENUM('automatico', 'manual', 'pre_restauracao'), allowNull: false },
      situacao: { type: DataTypes.ENUM('em_andamento', 'sucesso', 'falha', 'removido'), allowNull: false },
      tamanho: { type: DataTypes.BIGINT, allowNull: true },
      sha256: { type: DataTypes.STRING(64), allowNull: true },
      tabelas: { type: DataTypes.INTEGER, allowNull: true },
      registros: { type: DataTypes.INTEGER, allowNull: true },
      erro: { type: DataTypes.STRING(500), allowNull: true },
      usuarioId: { type: DataTypes.INTEGER, allowNull: true },
      iniciadoEm: { type: DataTypes.DATE, allowNull: false },
      concluidoEm: { type: DataTypes.DATE, allowNull: true },
      restauradoEm: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'backups', timestamps: false }
  );
  Backup.associate = (models) => {
    Backup.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
  };
  return Backup;
};
