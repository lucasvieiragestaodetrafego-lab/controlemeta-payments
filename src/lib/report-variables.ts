// Fonte única de verdade das variáveis de mensagem disponíveis nos
// Relatórios de Métricas — usada tanto pelo seletor de variáveis na UI
// quanto pelo cálculo das métricas (meta-insights.ts / check-reports.ts).
// Módulo puro (sem fetch/env), seguro pra importar em componente client.

/** Um resultado específico de campanha (ex: compra, carrinho) rastreável via `actions` da Graph API. */
export interface TrackedActionMetric {
  /** Nome da variável de contagem, ex: {compras}. */
  key: string;
  /** Nome da variável de custo por resultado, ex: {custo_por_compra}. */
  costKey: string;
  label: string;
  /** Tipos de ação da Graph API somados para essa métrica (varia conforme a otimização da campanha). */
  actionTypes: string[];
}

export const TRACKED_ACTIONS: TrackedActionMetric[] = [
  {
    key: "compras",
    costKey: "custo_por_compra",
    label: "Compras",
    actionTypes: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"],
  },
  {
    key: "carrinho",
    costKey: "custo_por_carrinho",
    label: "Adicionou ao carrinho",
    actionTypes: ["add_to_cart", "omni_add_to_cart"],
  },
  {
    key: "checkout_iniciado",
    costKey: "custo_por_checkout",
    label: "Iniciou finalização de compra",
    actionTypes: ["initiate_checkout", "omni_initiated_checkout"],
  },
  {
    key: "cadastros",
    costKey: "custo_por_cadastro",
    label: "Cadastros completos",
    actionTypes: ["complete_registration", "omni_complete_registration"],
  },
  {
    key: "leads",
    costKey: "custo_por_lead",
    label: "Leads",
    actionTypes: ["lead", "onsite_conversion.lead_grouped"],
  },
  {
    key: "conversas_iniciadas",
    costKey: "custo_por_conversa",
    label: "Conversas iniciadas (WhatsApp/Messenger)",
    actionTypes: [
      "onsite_conversion.messaging_conversation_started_7d",
      "onsite_conversion.messaging_first_reply",
    ],
  },
  {
    key: "cliques_link",
    costKey: "custo_por_clique_link",
    label: "Cliques no link",
    actionTypes: ["link_click"],
  },
  {
    key: "visualizacoes_pagina",
    costKey: "custo_por_visualizacao_pagina",
    label: "Visualizações da página de destino",
    actionTypes: ["landing_page_view"],
  },
  {
    key: "info_pagamento",
    costKey: "custo_por_info_pagamento",
    label: "Adicionou informação de pagamento",
    actionTypes: ["add_payment_info", "omni_add_payment_info"],
  },
  {
    key: "instalacoes_app",
    costKey: "custo_por_instalacao",
    label: "Instalações do app",
    actionTypes: ["mobile_app_install", "omni_app_install"],
  },
];

export interface Variable {
  key: string;
  label: string;
}

export interface VariableCategory {
  name: string;
  variables: Variable[];
}

export const VARIABLE_CATEGORIES: VariableCategory[] = [
  {
    name: "Geral",
    variables: [
      { key: "conta", label: "Conta" },
      { key: "periodo", label: "Período" },
      { key: "data_inicio", label: "Data início" },
      { key: "data_fim", label: "Data fim" },
    ],
  },
  {
    name: "Alcance e Frequência",
    variables: [
      { key: "alcance", label: "Alcance" },
      { key: "impressoes", label: "Impressões" },
      { key: "frequencia", label: "Frequência" },
    ],
  },
  {
    name: "Cliques",
    variables: [
      { key: "cliques", label: "Cliques" },
      { key: "cliques_unicos", label: "Cliques únicos" },
      { key: "ctr", label: "CTR" },
      { key: "ctr_unico", label: "CTR único" },
    ],
  },
  {
    name: "Custo",
    variables: [
      { key: "investimento", label: "Investimento" },
      { key: "cpc", label: "CPC (custo por clique)" },
      { key: "cpm", label: "CPM (custo por mil impressões)" },
      { key: "custo_por_conversao", label: "Custo por conversão (resultado principal)" },
    ],
  },
  {
    name: "Conversão e Resultado",
    variables: [
      { key: "conversoes", label: "Conversões (resultado principal)" },
      { key: "roas", label: "ROAS" },
      { key: "ticket_medio", label: "Ticket médio" },
    ],
  },
  {
    name: "Conversões detalhadas",
    variables: TRACKED_ACTIONS.map((a) => ({ key: a.key, label: a.label })),
  },
  {
    name: "Custo por conversão detalhado",
    variables: TRACKED_ACTIONS.map((a) => ({
      key: a.costKey,
      label: `Custo por ${a.label.toLowerCase()}`,
    })),
  },
  {
    name: "Engajamento",
    variables: [
      { key: "engajamento", label: "Engajamento (curtidas, comentários, cliques no post)" },
      { key: "visualizacoes_video", label: "Visualizações de vídeo" },
    ],
  },
  {
    name: "Criativos",
    variables: [{ key: "top_criativos", label: "Top criativos" }],
  },
];

export const ALL_VARIABLES: Variable[] = VARIABLE_CATEGORIES.flatMap((c) => c.variables);
