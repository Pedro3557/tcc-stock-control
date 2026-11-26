const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const configs = require('../config/database');

const ambiente = process.env.NODE_ENV || 'development';
const config = configs[ambiente];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

const db = {};

fs.readdirSync(__dirname)
  .filter((arquivo) => arquivo !== 'index.js' && arquivo.endsWith('.js'))
  .forEach((arquivo) => {
    const model = require(path.join(__dirname, arquivo))(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') model.associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
