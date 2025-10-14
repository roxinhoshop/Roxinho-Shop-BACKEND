# TODO - Correções Roxinho Shop Backend

## Tarefas Identificadas:

1. **Corrigir autenticação e login**
   - Modificar retorno do login para incluir dados do usuário (nome, não email)
   - Corrigir redirecionamento após cadastro para página de login
   - Corrigir redirecionamento após login para página inicial

2. **Corrigir histórico de produtos visualizados**
   - Verificar e corrigir funcionalidade do histórico
   - Garantir que está 100% funcional

3. **Corrigir rotas das APIs para Vercel**
   - Atualizar vercel.json para melhor compatibilidade
   - Garantir que todas as rotas funcionem corretamente na Vercel

4. **Implementar limite de 50MB para fotos de usuário**
   - Adicionar middleware de validação de tamanho de arquivo
   - Implementar tratamento de erro para arquivos muito grandes

5. **Testes e correções gerais**
   - Testar todas as funcionalidades
   - Corrigir erros de console no painel admin
   - Verificar se produtos são adicionados automaticamente via link
   - Fazer commits sem emojis

## Arquivos a serem modificados:
- routes/auth.js (login/cadastro)
- routes/historico.js (histórico de produtos)
- vercel.json (configuração Vercel)
- index.js (middleware de upload)
- Possíveis novos middlewares para validação