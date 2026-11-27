const { Op } = require('sequelize');
const { Notificacao, AlertaAtivo, Usuario, Produto } = require('../models');
const email = require('./emailService');
const configuracoes = require('./configuracaoService');
const { formatarNumeroBR } = require('../utils/formatos');

const PERFIS_OPERACIONAIS = ['admin', 'almoxarife'];

/** Usuários ativos que recebem notificações (configurável por usuário na tela Usuários). */
async function destinatarios(perfis = PERFIS_OPERACIONAIS) {
  return Usuario.findAll({ where: { ativo: true, recebeNotificacoes: true, perfil: perfis } });
}

/**
 * Cria a notificação para cada destinatário e, se habilitado, envia e-mail para quem optou por recebê-lo.
 * Nunca lança erro (uma falha de notificação não pode desfazer a operação que a gerou).
 */
async function notificar({ tipo, nivel = 'aviso', titulo, mensagem, link = null, chave = null, perfis }) {
  try {
    const usuarios = await destinatarios(perfis);
    if (usuarios.length === 0) return 0;
    await Notificacao.bulkCreate(usuarios.map((u) => ({ usuarioId: u.id, tipo, nivel, titulo, mensagem, link, chave })));

    if ((await configuracoes.obter('notificacoes.email')) === 'true' && email.configurado()) {
      const para = usuarios.filter((u) => u.recebeEmail).map((u) => u.email);
      if (para.length) {
        const org = await configuracoes.obter('organizacao.nome');
        await email.enviar({ para, assunto: `[${org}] ${titulo}`, texto: `${mensagem}\n\n— Controle de Estoque` });
      }
    }
    return usuarios.length;
  } catch (erro) {
    console.error('[notificações] falha ao notificar:', erro.message);
    return 0;
  }
}

/**
 * Abre um alerta para uma situação (chave única). Se a situação já está em alerta, nada é enviado de novo:
 * isso evita notificações repetidas a cada movimentação.
 */
async function abrirAlerta(chave, tipo, dadosNotificacao) {
  try {
    await AlertaAtivo.create({ chave, tipo });
  } catch (erro) {
    if (erro.name === 'SequelizeUniqueConstraintError') return false;
    throw erro;
  }
  await notificar({ ...dadosNotificacao, tipo, chave });
  return true;
}

async function encerrarAlerta(chave) {
  await AlertaAtivo.destroy({ where: { chave } });
}

/**
 * Confere produtos (todos, ou os ids informados) e abre/encerra alertas de:
 * - sem estoque (saldo zero em produto com estoque mínimo definido)
 * - abaixo do mínimo (saldo maior que zero, porém menor que o mínimo)
 */
async function verificarEstoque(produtoIds) {
  try {
    const where = produtoIds ? { id: produtoIds } : {};
    const produtos = await Produto.findAll({ where, attributes: ['id', 'codigo', 'nome', 'unidade', 'quantidade', 'estoqueMinimo', 'ativo'] });
    if (produtos.length === 0) return;

    const chaves = produtos.flatMap((p) => [`sem_estoque:${p.id}`, `estoque_minimo:${p.id}`]);
    const ativos = new Set((await AlertaAtivo.findAll({ where: { chave: chaves }, attributes: ['chave'] })).map((a) => a.chave));

    for (const p of produtos) {
      const qtd = Number(p.quantidade);
      const min = Number(p.estoqueMinimo);
      const semEstoque = p.ativo && min > 0 && qtd <= 0;
      const abaixo = p.ativo && qtd > 0 && qtd < min;
      const chaveSem = `sem_estoque:${p.id}`;
      const chaveMin = `estoque_minimo:${p.id}`;
      const link = `/produtos?busca=${encodeURIComponent(p.codigo)}`;

      if (semEstoque && !ativos.has(chaveSem)) {
         
        await abrirAlerta(chaveSem, 'sem_estoque', {
          nivel: 'critico',
          titulo: `Sem estoque: ${p.nome}`,
          mensagem: `O produto ${p.codigo} — ${p.nome} está com saldo zero (mínimo: ${formatarNumeroBR(min, 3)} ${p.unidade}).`,
          link,
        });
      } else if (!semEstoque && ativos.has(chaveSem)) {
         
        await encerrarAlerta(chaveSem);
      }

      if (abaixo && !ativos.has(chaveMin)) {
         
        await abrirAlerta(chaveMin, 'estoque_minimo', {
          nivel: 'aviso',
          titulo: `Abaixo do mínimo: ${p.nome}`,
          mensagem: `O produto ${p.codigo} — ${p.nome} tem ${formatarNumeroBR(qtd, 3)} ${p.unidade}, abaixo do mínimo de ${formatarNumeroBR(min, 3)} ${p.unidade}.`,
          link,
        });
      } else if (!abaixo && ativos.has(chaveMin)) {
         
        await encerrarAlerta(chaveMin);
      }
    }
  } catch (erro) {
    console.error('[notificações] falha ao verificar estoque:', erro.message);
  }
}

// ---------------------------------------------------------------------------
// Consulta pelo usuário logado
// ---------------------------------------------------------------------------
async function listar(usuarioId, { somenteNaoLidas, pagina = 1, limite = 30 }) {
  const where = { usuarioId };
  if (somenteNaoLidas) where.lida = false;
  const { rows, count } = await Notificacao.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: limite,
    offset: (pagina - 1) * limite,
  });
  return { dados: rows, total: count, pagina, limite, paginas: Math.max(1, Math.ceil(count / limite)) };
}

async function contarNaoLidas(usuarioId) {
  return Notificacao.count({ where: { usuarioId, lida: false } });
}

async function marcarLida(usuarioId, id) {
  const [alteradas] = await Notificacao.update({ lida: true, lidaEm: new Date() }, { where: { id, usuarioId, lida: false } });
  return alteradas;
}

async function marcarTodasLidas(usuarioId) {
  const [alteradas] = await Notificacao.update({ lida: true, lidaEm: new Date() }, { where: { usuarioId, lida: false } });
  return alteradas;
}

/** Remove notificações lidas há mais de 180 dias (mantém a tabela enxuta). */
async function limparAntigas() {
  const limite = new Date(Date.now() - 180 * 86400000);
  await Notificacao.destroy({ where: { lida: true, lidaEm: { [Op.lt]: limite } } });
}

module.exports = {
  notificar,
  verificarEstoque,
  listar,
  contarNaoLidas,
  marcarLida,
  marcarTodasLidas,
  limparAntigas,
};
