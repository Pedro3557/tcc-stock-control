module.exports = (sequelize, DataTypes) => {
  const Categoria = sequelize.define(
    'Categoria',
    {
      nome: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    },
    { tableName: 'categorias' }
  );

  Categoria.associate = (models) => {
    Categoria.hasMany(models.Produto, { foreignKey: 'categoriaId', as: 'produtos' });
  };

  return Categoria;
};
