'use strict';

const bcrypt = require('bcryptjs');

/**
 * Dados ESSENCIAIS para começar a usar o sistema (sem dados fictícios):
 * - administrador inicial: admin@provedor.com / admin123 — a troca de senha é obrigatória no primeiro acesso
 * - categorias usuais de um provedor (podem ser renomeadas ou excluídas enquanto não tiverem produtos)
 * Pode rodar de novo sem erro: o que já existe é mantido.
 */
const CATEGORIAS = ['ONU/ONT', 'Roteadores', 'Mesh', 'Switches', 'Rádios', 'Módulos SFP', 'Cabos', 'Conectores', 'Splitters', 'Caixas', 'Acessórios', 'Ferramentas'];

module.exports = {
  async up(queryInterface) {
    const agora = new Date();
    const ts = { createdAt: agora, updatedAt: agora };

    const [[{ total }]] = await queryInterface.sequelize.query('SELECT COUNT(*) AS total FROM usuarios');
    if (Number(total) === 0) {
      await queryInterface.bulkInsert('usuarios', [
        {
          nome: 'Administrador',
          email: 'admin@provedor.com',
          senhaHash: await bcrypt.hash('admin123', 10),
          perfil: 'admin',
          precisaTrocarSenha: true,
          recebeNotificacoes: true,
          recebeEmail: false,
          ativo: true,
          ...ts,
        },
      ]);
      console.log('Administrador criado: admin@provedor.com (senha provisória admin123, troca obrigatória no 1º acesso).');
    } else {
      console.log('Usuários já existem — administrador inicial não recriado.');
    }

    const [[{ cats }]] = await queryInterface.sequelize.query('SELECT COUNT(*) AS cats FROM categorias');
    if (Number(cats) === 0) {
      await queryInterface.bulkInsert('categorias', CATEGORIAS.map((nome) => ({ nome, ...ts })));
      console.log(`${CATEGORIAS.length} categorias padrão criadas.`);
    }
  },

  async down() {
    // Não remove nada: usuários e categorias podem já estar ligados a dados reais.
  },
};
