'use strict';

const crypto = require('crypto');

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para o código impresso na etiqueta
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function gerarCodigo() {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

/**
 * - produtos.descricao
 * - usuarios.senhaAlteradaEm (invalida tokens antigos após troca de senha)
 * - usuarios.recebeNotificacoes / recebeEmail
 * - equipamentos.codigoEtiqueta: identificador único e permanente usado no QR Code
 * - índice para o saldo de material por técnico
 * Compatível com bancos existentes: só adiciona colunas e preenche o código das unidades já cadastradas.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('produtos', 'descricao', { type: Sequelize.TEXT, allowNull: true, after: 'nome' });

    await queryInterface.addColumn('usuarios', 'senhaAlteradaEm', { type: Sequelize.DATE, allowNull: true, after: 'senhaHash' });
    await queryInterface.addColumn('usuarios', 'recebeNotificacoes', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true, after: 'precisaTrocarSenha',
    });
    await queryInterface.addColumn('usuarios', 'recebeEmail', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, after: 'recebeNotificacoes',
    });
    // Perfil "consulta" não recebe alertas operacionais por padrão
    await queryInterface.bulkUpdate('usuarios', { recebeNotificacoes: false }, { perfil: 'consulta' });

    await queryInterface.addColumn('equipamentos', 'codigoEtiqueta', { type: Sequelize.STRING(16), allowNull: true, after: 'id' });
    const [equipamentos] = await queryInterface.sequelize.query('SELECT id FROM equipamentos WHERE codigoEtiqueta IS NULL');
    const usados = new Set();
    for (const { id } of equipamentos) {
      let codigo;
      do codigo = gerarCodigo(); while (usados.has(codigo));
      usados.add(codigo);
       
      await queryInterface.bulkUpdate('equipamentos', { codigoEtiqueta: codigo }, { id });
    }
    await queryInterface.changeColumn('equipamentos', 'codigoEtiqueta', { type: Sequelize.STRING(16), allowNull: false });
    await queryInterface.addIndex('equipamentos', ['codigoEtiqueta'], { unique: true, name: 'equipamentos_codigo_etiqueta_unico' });

    await queryInterface.addIndex('movimentacoes', ['tecnicoId', 'produtoId'], { name: 'movimentacoes_tecnico_produto' });
    // Índice simples criado por um "down" anterior (desfazer e refazer): o composto já atende a chave estrangeira
    const [indices] = await queryInterface.sequelize.query("SHOW INDEX FROM movimentacoes WHERE Key_name = 'movimentacoes_tecnico'");
    if (indices.length) await queryInterface.removeIndex('movimentacoes', 'movimentacoes_tecnico');
  },

  async down(queryInterface) {
    // O MySQL pode estar usando o índice composto na chave estrangeira de tecnicoId: cria um simples antes
    await queryInterface.addIndex('movimentacoes', ['tecnicoId'], { name: 'movimentacoes_tecnico' });
    await queryInterface.removeIndex('movimentacoes', 'movimentacoes_tecnico_produto');
    await queryInterface.removeIndex('equipamentos', 'equipamentos_codigo_etiqueta_unico');
    await queryInterface.removeColumn('equipamentos', 'codigoEtiqueta');
    await queryInterface.removeColumn('usuarios', 'recebeEmail');
    await queryInterface.removeColumn('usuarios', 'recebeNotificacoes');
    await queryInterface.removeColumn('usuarios', 'senhaAlteradaEm');
    await queryInterface.removeColumn('produtos', 'descricao');
  },
};
