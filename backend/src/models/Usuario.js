const { PERFIS } = require('../config/constantes');

module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define(
    'Usuario',
    {
      nome: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      senhaHash: { type: DataTypes.STRING(100), allowNull: false },
      perfil: { type: DataTypes.ENUM(...PERFIS), allowNull: false, defaultValue: 'consulta' },
      precisaTrocarSenha: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'usuarios',
      defaultScope: { attributes: { exclude: ['senhaHash'] } },
      scopes: { comSenha: { attributes: { include: ['senhaHash'] } } },
    }
  );

  Usuario.prototype.toJSON = function toJSON() {
    const valores = { ...this.get() };
    delete valores.senhaHash;
    return valores;
  };

  return Usuario;
};
