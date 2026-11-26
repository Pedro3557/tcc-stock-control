import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Login from './pages/Login.jsx';
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
        <Route index element={<Painel />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="equipamentos" element={<Equipamentos />} />
        <Route path="equipamentos/:id" element={<EquipamentoDetalhe />} />
        <Route
          path="movimentacoes/nova"
          element={<RotaProtegida perfis={['admin', 'almoxarife']}><NovaMovimentacao /></RotaProtegida>}
        />
        <Route path="movimentacoes" element={<Movimentacoes />} />
        <Route path="tecnicos" element={<Tecnicos />} />
        <Route path="tecnicos/:id" element={<TecnicoEstoque />} />
        <Route path="fornecedores" element={<Fornecedores />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="usuarios" element={<RotaProtegida perfis={['admin']}><Usuarios /></RotaProtegida>} />
        <Route path="inicio" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  );
}
