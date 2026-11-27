import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Login from './pages/Login.jsx';
import TrocarSenha from './pages/TrocarSenha.jsx';
import Relatorios from './pages/Relatorios.jsx';
import Importar from './pages/Importar.jsx';
import Painel from './pages/Painel.jsx';
import Produtos from './pages/Produtos.jsx';
import Equipamentos from './pages/Equipamentos.jsx';
import EquipamentoDetalhe from './pages/EquipamentoDetalhe.jsx';
import NovaMovimentacao from './pages/NovaMovimentacao.jsx';
import Movimentacoes from './pages/Movimentacoes.jsx';
import Tecnicos from './pages/Tecnicos.jsx';
import TecnicoEstoque from './pages/TecnicoEstoque.jsx';
import Fornecedores from './pages/Fornecedores.jsx';
import Categorias from './pages/Categorias.jsx';
import Usuarios from './pages/Usuarios.jsx';
import NaoEncontrado from './pages/NaoEncontrado.jsx';
import Leitor from './pages/Leitor.jsx';
import AbrirEtiqueta from './pages/AbrirEtiqueta.jsx';
import Etiquetas from './pages/Etiquetas.jsx';
import Inventarios from './pages/Inventarios.jsx';
import InventarioDetalhe from './pages/InventarioDetalhe.jsx';
import Notificacoes from './pages/Notificacoes.jsx';
import Auditoria from './pages/Auditoria.jsx';
import Backups from './pages/Backups.jsx';
import Configuracoes from './pages/Configuracoes.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/trocar-senha" element={<TrocarSenha />} />
      <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
        <Route index element={<Painel />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="equipamentos" element={<Equipamentos />} />
        <Route path="equipamentos/:id" element={<EquipamentoDetalhe />} />
        <Route path="ler" element={<Leitor />} />
        <Route path="e/:codigo" element={<AbrirEtiqueta />} />
        <Route path="inventarios" element={<Inventarios />} />
        <Route path="inventarios/:id" element={<InventarioDetalhe />} />
        <Route path="etiquetas" element={<RotaProtegida perfis={['admin', 'almoxarife']}><Etiquetas /></RotaProtegida>} />
        <Route
          path="movimentacoes/nova"
          element={<RotaProtegida perfis={['admin', 'almoxarife']}><NovaMovimentacao /></RotaProtegida>}
        />
        <Route path="movimentacoes" element={<Movimentacoes />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route
          path="importar"
          element={<RotaProtegida perfis={['admin', 'almoxarife']}><Importar /></RotaProtegida>}
        />
        <Route path="tecnicos" element={<Tecnicos />} />
        <Route path="tecnicos/:id" element={<TecnicoEstoque />} />
        <Route path="fornecedores" element={<Fornecedores />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="notificacoes" element={<Notificacoes />} />
        <Route path="usuarios" element={<RotaProtegida perfis={['admin']}><Usuarios /></RotaProtegida>} />
        <Route path="auditoria" element={<RotaProtegida perfis={['admin']}><Auditoria /></RotaProtegida>} />
        <Route path="backups" element={<RotaProtegida perfis={['admin']}><Backups /></RotaProtegida>} />
        <Route path="configuracoes" element={<RotaProtegida perfis={['admin']}><Configuracoes /></RotaProtegida>} />
        <Route path="inicio" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  );
}
