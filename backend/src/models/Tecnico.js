module.exports = (sequelize, DataTypes) => {
  const Tecnico = sequelize.define(
    'Tecnico',
    {
      nome: { type: DataTypes.STRING(120), allowNull: false },
      telefone: { type: DataTypes.STRING(20) },
      equipe: { type: DataTypes.STRING(60) },
      ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'tecnicos' }
  );

  Tecnico.associate = (models) => {
    Tecnico.hasMany(models.Equipamento, { foreignKey: 'tecnicoId', as: 'equipamentos' });
    Tecnico.hasMany(models.Movimentacao, { foreignKey: 'tecnicoId', as: 'movimentacoes' });
  };

  return Tecnico;
};
