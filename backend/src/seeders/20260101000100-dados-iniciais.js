'use strict';

const bcrypt = require('bcryptjs');

/**
 * Dados iniciais para começar a usar o sistema:
 * usuários, categorias, produtos típicos de provedor, unidades de ONU/roteador,
 * dois técnicos, um fornecedor e as movimentações que geram esses saldos.
 */
module.exports = {
  async up(queryInterface) {
    const agora = new Date();
    const diasAtras = (dias, horas = 9) => {
      const d = new Date(agora);
      d.setDate(d.getDate() - dias);
      d.setHours(horas, 0, 0, 0);
      return d;
    };
    const ts = { createdAt: agora, updatedAt: agora };

    // ---------------- Usuários ----------------
    await queryInterface.bulkInsert('usuarios', [
      { id: 1, nome: 'Administrador', email: 'admin@provedor.com', senhaHash: await bcrypt.hash('admin123', 10), perfil: 'admin', ativo: true, ...ts },
      { id: 2, nome: 'Almoxarifado', email: 'almoxarife@provedor.com', senhaHash: await bcrypt.hash('almox123', 10), perfil: 'almoxarife', ativo: true, ...ts },
      { id: 3, nome: 'Consulta', email: 'consulta@provedor.com', senhaHash: await bcrypt.hash('consulta123', 10), perfil: 'consulta', ativo: true, ...ts },
    ]);

    // ---------------- Categorias ----------------
    const categorias = ['ONU/ONT', 'Roteadores', 'Mesh', 'Switches', 'Rádios', 'Módulos SFP', 'Cabos', 'Conectores', 'Splitters', 'Caixas', 'Acessórios', 'Ferramentas'];
    await queryInterface.bulkInsert('categorias', categorias.map((nome, i) => ({ id: i + 1, nome, ...ts })));
    const cat = Object.fromEntries(categorias.map((nome, i) => [nome, i + 1]));

    // ---------------- Técnicos e fornecedor ----------------
    await queryInterface.bulkInsert('tecnicos', [
      { id: 1, nome: 'Carlos Souza', telefone: '(11) 98888-1111', equipe: 'Instalação', ativo: true, ...ts },
      { id: 2, nome: 'Rafael Lima', telefone: '(11) 97777-2222', equipe: 'Manutenção de rede', ativo: true, ...ts },
    ]);
    await queryInterface.bulkInsert('fornecedores', [
      { id: 1, nome: 'FibraTech Distribuidora Ltda', cnpj: '12.345.678/0001-90', telefone: '(11) 3333-4444', email: 'vendas@fibratech.com.br', ...ts },
    ]);

    // ---------------- Produtos ----------------
    // [codigo, nome, marca, modelo, categoria, tipoControle, unidade, local, minimo, custo, quantidadeEntrada, saidaTecnico1]
    const produtos = [
      ['ONU-HW-EG8145', 'ONU GPON Wi-Fi AC Dual Band', 'Huawei', 'EG8145V5', 'ONU/ONT', 'serializado', 'un', 'A1-01', 5, 189.9],
      ['ONU-ITB-110GI', 'ONU GPON Bridge 1 porta Giga', 'Intelbras', '110 Gi', 'ONU/ONT', 'serializado', 'un', 'A1-02', 5, 98.5],
      ['ROT-TPL-C6', 'Roteador Wi-Fi AC1200 Gigabit', 'TP-Link', 'Archer C6', 'Roteadores', 'serializado', 'un', 'A2-01', 4, 219.0],
      ['MESH-ITB-TWIBI', 'Roteador Mesh Wi-Fi 5 Gigabit', 'Intelbras', 'Twibi Giga', 'Mesh', 'serializado', 'un', 'A2-02', 2, 289.0],
      ['SFP-1G-20KM', 'Módulo SFP 1,25G 20 km SC', 'Genérico', 'BIDI 1310/1550', 'Módulos SFP', 'serializado', 'un', 'A3-01', 2, 45.0],
      ['CABO-DROP-1F', 'Cabo drop flat 1 fibra (low friction)', 'Furukawa', 'Drop 1F', 'Cabos', 'quantidade', 'm', 'B1-01', 1000, 0.45, 2000, 200],
      ['CABO-UTP-C5E', 'Cabo UTP Cat5e cinza', 'Furukawa', 'Cat5e', 'Cabos', 'quantidade', 'm', 'B1-02', 300, 1.2, 610, 30],
      ['CON-SC-APC', 'Conector rápido SC/APC', 'Genérico', 'Fast SC/APC', 'Conectores', 'quantidade', 'un', 'C1-01', 200, 2.8, 150, 20],
      ['CON-RJ45-C5E', 'Conector RJ45 Cat5e', 'Genérico', 'RJ45 8P8C', 'Conectores', 'quantidade', 'un', 'C1-02', 200, 0.35, 500, 0],
      ['SPL-PLC-1X8', 'Splitter PLC 1x8 SC/APC', 'Genérico', 'PLC 1x8', 'Splitters', 'quantidade', 'un', 'C2-01', 10, 28.0, 25, 0],
      ['CTO-16P', 'Caixa de terminação óptica (CTO) 16 portas', 'Genérico', 'CTO 16', 'Caixas', 'quantidade', 'un', 'D1-01', 5, 145.0, 6, 0],
      ['CEO-24F', 'Caixa de emenda óptica 24 fibras', 'Genérico', 'CEO 24F', 'Caixas', 'quantidade', 'un', 'D1-02', 2, 160.0, 3, 0],
      ['FITA-ISOL', 'Fita isolante 19 mm x 20 m', '3M', 'Imperial', 'Acessórios', 'quantidade', 'un', 'E1-01', 20, 6.5, 40, 0],
      ['ABRAC-NYLON', 'Abraçadeira de nylon 200 mm (pct c/ 100)', 'Genérico', '200x4,8', 'Acessórios', 'quantidade', 'pct', 'E1-02', 10, 12.0, 15, 0],
      ['FONTE-12V1A', 'Fonte 12V 1A para ONU/roteador', 'Genérico', '12V 1A', 'Acessórios', 'quantidade', 'un', 'E1-03', 20, 14.9, 30, 0],
    ];

    await queryInterface.bulkInsert(
      'produtos',
      produtos.map((p, i) => ({
        id: i + 1,
        codigo: p[0],
        nome: p[1],
        marca: p[2],
        modelo: p[3],
        categoriaId: cat[p[4]],
        tipoControle: p[5],
        unidade: p[6],
        local: p[7],
        estoqueMinimo: p[8],
        custoUnitario: p[9],
        quantidade: p[5] === 'quantidade' ? p[10] - (p[11] || 0) : 0,
        ativo: true,
        ...ts,
      }))
    );

    // ---------------- Equipamentos serializados ----------------
    // [produtoId, numeroSerie, mac, statusFinal, tecnicoId, clienteCodigo, clienteNome]
    const equipamentos = [
      [1, 'HWTC1A2B3C01', 'E0:24:7F:10:00:01', 'em_estoque'],
      [1, 'HWTC1A2B3C02', 'E0:24:7F:10:00:02', 'em_estoque'],
      [1, 'HWTC1A2B3C03', 'E0:24:7F:10:00:03', 'em_estoque'],
      [1, 'HWTC1A2B3C04', 'E0:24:7F:10:00:04', 'em_estoque'],
      [1, 'HWTC1A2B3C05', 'E0:24:7F:10:00:05', 'em_estoque'],
      [1, 'HWTC1A2B3C06', 'E0:24:7F:10:00:06', 'com_tecnico', 1],
      [1, 'HWTC1A2B3C07', 'E0:24:7F:10:00:07', 'instalado_cliente', null, '10234', 'Maria Aparecida Santos'],
      [1, 'HWTC1A2B3C08', 'E0:24:7F:10:00:08', 'defeito'],
      [2, 'ITBS0110GI0001', 'D8:77:8B:20:00:01', 'em_estoque'],
      [2, 'ITBS0110GI0002', 'D8:77:8B:20:00:02', 'em_estoque'],
      [2, 'ITBS0110GI0003', 'D8:77:8B:20:00:03', 'instalado_cliente', null, '10567', 'João Pereira Lima'],
      [3, '22155A0C6001', '98:DA:C4:30:00:01', 'em_estoque'],
      [3, '22155A0C6002', '98:DA:C4:30:00:02', 'em_estoque'],
      [3, '22155A0C6003', '98:DA:C4:30:00:03', 'com_tecnico', 2],
      [3, '22155A0C6004', '98:DA:C4:30:00:04', 'instalado_cliente', null, '10234', 'Maria Aparecida Santos'],
      [3, '22155A0C6005', '98:DA:C4:30:00:05', 'em_manutencao'],
      [5, 'SFP20KM0001', null, 'em_estoque'],
      [5, 'SFP20KM0002', null, 'em_estoque'],
      [5, 'SFP20KM0003', null, 'em_estoque'],
    ];

    await queryInterface.bulkInsert(
      'equipamentos',
      equipamentos.map((e, i) => ({
        id: i + 1,
        produtoId: e[0],
        numeroSerie: e[1],
        mac: e[2],
        status: e[3],
        tecnicoId: e[3] === 'com_tecnico' ? e[4] : null,
        clienteCodigo: e[3] === 'instalado_cliente' ? e[5] : null,
        clienteNome: e[3] === 'instalado_cliente' ? e[6] : null,
        observacao: e[3] === 'defeito' ? 'Não sincroniza na OLT (LOS aceso).' : null,
        ...ts,
      }))
    );

    // Quantidade dos serializados = unidades em estoque
    const emEstoque = {};
    equipamentos.forEach((e) => {
      if (e[3] === 'em_estoque') emEstoque[e[0]] = (emEstoque[e[0]] || 0) + 1;
    });
    for (const [produtoId, qtd] of Object.entries(emEstoque)) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.bulkUpdate('produtos', { quantidade: qtd }, { id: Number(produtoId) });
    }

    // ---------------- Movimentações que geram os saldos acima ----------------
    const movs = [];
    const mov = (dados) => movs.push({
      equipamentoId: null, tecnicoId: null, fornecedorId: null, clienteCodigo: null, numeroOS: null,
      notaFiscal: null, observacao: null, statusAnterior: null, statusNovo: null, usuarioId: 1, ...dados,
    });

    // Entradas de compra (NF 004512)
    produtos.forEach((p, i) => {
      if (p[5] === 'quantidade') {
        mov({ produtoId: i + 1, tipo: 'entrada_compra', quantidade: p[10], fornecedorId: 1, notaFiscal: '004512', createdAt: diasAtras(10) });
      }
    });
    equipamentos.forEach((e, i) => {
      mov({ produtoId: e[0], equipamentoId: i + 1, tipo: 'entrada_compra', quantidade: 1, fornecedorId: 1, notaFiscal: '004512', statusNovo: 'em_estoque', createdAt: diasAtras(10) });
    });

    // Material de consumo entregue ao técnico Carlos (id 1)
    produtos.forEach((p, i) => {
      if (p[5] === 'quantidade' && p[11]) {
        mov({ produtoId: i + 1, tipo: 'saida_tecnico', quantidade: p[11], tecnicoId: 1, usuarioId: 2, createdAt: diasAtras(3, 8) });
      }
    });

    // Histórico de cada equipamento conforme o status final
    equipamentos.forEach((e, i) => {
      const base = { produtoId: e[0], equipamentoId: i + 1, quantidade: 1, usuarioId: 2 };
      switch (e[3]) {
        case 'com_tecnico':
          mov({ ...base, tipo: 'saida_tecnico', tecnicoId: e[4], statusAnterior: 'em_estoque', statusNovo: 'com_tecnico', createdAt: diasAtras(2, 8) });
          break;
        case 'instalado_cliente':
          mov({ ...base, tipo: 'saida_tecnico', tecnicoId: 1, statusAnterior: 'em_estoque', statusNovo: 'com_tecnico', createdAt: diasAtras(5, 8) });
          mov({ ...base, tipo: 'instalacao_cliente', tecnicoId: 1, clienteCodigo: e[5], numeroOS: `OS-${2400 + i}`, statusAnterior: 'com_tecnico', statusNovo: 'instalado_cliente', createdAt: diasAtras(5, 14) });
          break;
        case 'defeito':
          mov({ ...base, tipo: 'saida_tecnico', tecnicoId: 2, statusAnterior: 'em_estoque', statusNovo: 'com_tecnico', createdAt: diasAtras(8, 8) });
          mov({ ...base, tipo: 'instalacao_cliente', tecnicoId: 2, clienteCodigo: '09871', numeroOS: 'OS-2381', statusAnterior: 'com_tecnico', statusNovo: 'instalado_cliente', createdAt: diasAtras(8, 15) });
          mov({ ...base, tipo: 'retirada_cliente', tecnicoId: 2, clienteCodigo: '09871', numeroOS: 'OS-2399', observacao: 'Troca por defeito: não sincroniza na OLT (LOS aceso).', statusAnterior: 'instalado_cliente', statusNovo: 'defeito', createdAt: diasAtras(1, 10) });
          break;
        case 'em_manutencao':
          mov({ ...base, tipo: 'envio_manutencao', observacao: 'Reiniciando sozinho. Enviado para assistência técnica.', statusAnterior: 'em_estoque', statusNovo: 'em_manutencao', createdAt: diasAtras(4, 11) });
          break;
        default:
          break;
      }
    });

    await queryInterface.bulkInsert('movimentacoes', movs);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('movimentacoes', null, {});
    await queryInterface.bulkDelete('equipamentos', null, {});
    await queryInterface.bulkDelete('produtos', null, {});
    await queryInterface.bulkDelete('fornecedores', null, {});
    await queryInterface.bulkDelete('tecnicos', null, {});
    await queryInterface.bulkDelete('categorias', null, {});
    await queryInterface.bulkDelete('usuarios', null, {});
  },
};
