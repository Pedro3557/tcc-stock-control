-- Executado só na PRIMEIRA criação do container: banco separado para os testes automatizados
CREATE DATABASE IF NOT EXISTS estoque_provedor_teste CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON estoque_provedor_teste.* TO 'estoque'@'%';
FLUSH PRIVILEGES;
