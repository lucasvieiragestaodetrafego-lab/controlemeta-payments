# Agrupamento por cliente + seleção de grupo do WhatsApp por nome

Data: 2026-07-14

## Contexto

A página de Relatórios (`/`) lista uma linha por conta de anúncio (`ad_accounts`).
Hoje cada cliente (`clients`) tem exatamente 1 conta cadastrada (107 clientes, 0 com
mais de 1 conta), mas o modelo de dados já suporta múltiplas contas por cliente — e
isso vai passar a acontecer quando o Google Ads for integrado (um mesmo cliente terá
uma automação Meta e uma automação Google).

Separadamente, o campo "Grupo/telefone WhatsApp" nos modais de criar/editar relatório
é hoje um texto livre onde se cola o código do grupo (ex:
`120363421960030596-group`), e a tabela mostra esse código bruto na coluna de destino.
Isso dificulta saber pra qual grupo real o alerta vai, e vai atrapalhar quando
precisarmos escolher grupos de clientes na hora de configurar disparos.

Este documento cobre três mudanças combinadas, pedidas juntas pelo usuário:

1. Agrupar a tabela de relatórios por cliente.
2. Trocar o campo de texto do grupo do WhatsApp por um seletor com busca, pelo nome
   real do grupo.
3. Criar um documento de registro geral do projeto no repositório.

## 1. Agrupamento por cliente

### Comportamento

- A tabela deixa de ser "uma linha por conta" e passa a ser "um grupo por cliente,
  com uma sub-linha por conta/automação daquele cliente".
- Cada grupo tem uma linha de cabeçalho mostrando apenas o nome do cliente (sem dados
  de conta), seguida por 1+ sub-linhas com as colunas atuais (Plataforma, Tipo,
  Saldo, Tendência, Situação, Gestor, Automação, Ações).
- Clientes com 1 conta só (hoje, 100% dos casos) mostram cabeçalho + 1 sub-linha —
  visualmente quase idêntico à tabela atual, só com o nome do cliente destacado
  acima em vez de dentro da célula "Conta".
- Quando um cliente tiver 2+ contas (ex: Meta + Google no futuro), elas aparecem como
  sub-linhas adicionais sob o mesmo cabeçalho, sem repetir o nome do cliente.
- Filtros, busca e a alternância Tabela/Cards continuam funcionando: o filtro atua
  sobre as contas: se uma conta bate com o filtro, seu grupo (cliente) aparece.
- Na visão Cards, o agrupamento aparece como um rótulo do nome do cliente acima do(s)
  card(s) daquele cliente.
- O gráfico de risco no topo da página não muda (continua contando contas em risco,
  não clientes).

### Dados

- A consulta que já traz `ad_accounts` passa a trazer também `clients.name` via join
  (a tabela `clients` já existe e já é referenciada por `ad_accounts.client_id`).
- Nenhuma migração de banco é necessária para este item.
- Agrupamento e ordenação acontecem no componente (ordenar por nome do cliente, e
  dentro do cliente por nome da conta), sem mudar a forma como os dados são buscados
  no Supabase além do join.

## 2. Seletor de grupo do WhatsApp por nome

### Comportamento

- Nos modais "Novo relatório" e "Editar", o campo de texto livre do grupo do
  WhatsApp é substituído por um seletor com campo de busca (dropdown), listando os
  grupos pelo nome real, com um campo "Pesquisar pelo nome" no topo.
- Só é possível escolher um grupo da lista (sem opção de colar código manualmente),
  conforme confirmado.
- Na tabela de Relatórios, a coluna/exibição do grupo passa a mostrar o nome do
  grupo em vez do código bruto.

### Dados e integração

- Novo endpoint de servidor que busca a lista de chats da instância Z-API (endpoint
  de chats já disponível na API que a integração usa) e filtra apenas grupos
  (retornam nome + id de cada grupo).
- Essa busca é cacheada por poucos minutos (evitar bater na Z-API a cada abertura de
  modal) — cache em memória no processo do servidor é suficiente (não precisa de
  tabela nova).
- Continuamos gravando o código do grupo (`whatsapp_group_id`, como hoje) nas contas.
  Adicionamos também o nome do grupo em `ad_accounts` (nova coluna
  `whatsapp_group_name`, nullable) para a tabela poder mostrar o nome sem precisar
  bater na Z-API a cada carregamento da página de Relatórios.
- Ao salvar (criar ou editar) um relatório, o nome escolhido no seletor é salvo junto
  com o código.
- Contas já existentes ficam com `whatsapp_group_name` vazio até serem editadas e
  salvas de novo com o seletor — a tabela mostra o código bruto como hoje nesses
  casos (fallback), sem quebrar nada.
- Se a Z-API não responder (instância offline, etc.), o seletor mostra uma mensagem
  de erro amigável e o modal continua utilizável para os outros campos — mas como
  não há mais campo de texto livre, salvar o grupo fica bloqueado até a lista
  carregar.

### Migração

- `supabase/migrations/0007_whatsapp_group_name.sql`: adiciona coluna
  `whatsapp_group_name text` (nullable) em `ad_accounts`.

## 3. Documento de registro do projeto

- Novo arquivo `docs/PROJETO.md`, versionado no Git: visão geral do que é o app
  (painel de alertas de saldo de contas de anúncio via WhatsApp), por que existe,
  principais funcionalidades atuais (alertas de saldo, automações por conta,
  templates de mensagem, coluna de plataforma, gráfico de risco, etc.) e uma seção
  "Em construção / próximos passos" citando o agrupamento por cliente, o seletor de
  grupo por nome e a futura integração com Google Ads.
- Não é um changelog técnico linha a linha — é um resumo de produto, atualizado à
  mão conforme features relevantes forem adicionadas.

## Fora de escopo

- Integração real com Google Ads (só a preparação estrutural do agrupamento).
- Edição/exclusão de grupos do WhatsApp pelo painel (só leitura, para seleção).
- Sincronização automática de `whatsapp_group_name` para contas antigas (fica
  pendente até a próxima edição de cada conta).

## Testes

- `src/lib/` ganha (se necessário) uma função pura para agrupar contas por cliente a
  partir de uma lista plana — testável com Vitest, seguindo o padrão já usado em
  `risk-series.test.ts`.
- Função de filtro/formatação da lista de grupos da Z-API (separar grupos de
  contatos individuais) também pode ser extraída como função pura testável.
