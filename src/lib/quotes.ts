export interface Quote {
  text: string;
  author: string;
}

/**
 * Banco de frases motivacionais — só empreendedores de sucesso, referências
 * de negócios/marketing e campeões conhecidos pela mentalidade de vencedor.
 * Sem filósofos, poetas, políticos ou frases de tom "vitimista"/reflexivo.
 *
 * A troca a cada hora não depende de nenhum agendamento externo: o índice é
 * calculado a partir da hora atual (UTC), então todo mundo vê a mesma frase
 * durante a mesma hora, e ela muda sozinha quando a hora vira.
 */
export const QUOTES: Quote[] = [
  { text: "A inovação distingue um líder de um seguidor.", author: "Steve Jobs" },
  { text: "O único jeito de fazer um excelente trabalho é amar o que você faz.", author: "Steve Jobs" },
  { text: "Não deixe o barulho da opinião dos outros abafar sua própria voz interior.", author: "Steve Jobs" },
  { text: "Fique com fome, fique com humildade.", author: "Steve Jobs" },
  { text: "Não espere por oportunidades extraordinárias. Aproveite ocasiões comuns e faça-as grandiosas.", author: "Orison Swett Marden" },
  { text: "Não tenha medo de desistir do bom para buscar o ótimo.", author: "John D. Rockefeller" },
  { text: "A melhor forma de prever o futuro é criá-lo.", author: "Peter Drucker" },
  { text: "Motivação é o que te faz começar. Hábito é o que te mantém indo.", author: "Jim Ryun" },
  { text: "A disciplina é a ponte entre metas e realizações.", author: "Jim Rohn" },
  { text: "Você não precisa ser ótimo para começar, mas precisa começar para ser ótimo.", author: "Zig Ziglar" },
  { text: "Marketing é uma batalha de percepções, não de produtos.", author: "Al Ries" },
  { text: "O objetivo do marketing é conhecer e entender tão bem o cliente que o produto se venda sozinho.", author: "Peter Drucker" },
  { text: "As pessoas não compram o que você faz, elas compram por que você faz.", author: "Simon Sinek" },
  { text: "Conteúdo é rei, mas distribuição é rainha e governa a casa.", author: "Gary Vaynerchuk" },
  { text: "Marketing não é mais sobre as coisas que você faz, é sobre as histórias que você conta.", author: "Seth Godin" },
  { text: "Não encontre clientes para seus produtos, encontre produtos para seus clientes.", author: "Seth Godin" },
  { text: "A propaganda que não vende, não é criativa.", author: "David Ogilvy" },
  { text: "O consumidor não é idiota; ele é sua esposa.", author: "David Ogilvy" },
  { text: "Faça publicidade ou venda seu produto por atacado.", author: "Claude Hopkins" },
  { text: "Se você trabalha só por dinheiro, nunca vai enriquecer. Mas se você ama o que faz e coloca o cliente em primeiro lugar, o sucesso será seu.", author: "Ray Kroc" },
  { text: "O fracasso é apenas a oportunidade de recomeçar de novo, de forma mais inteligente.", author: "Henry Ford" },
  { text: "Se eu tivesse perguntado às pessoas o que queriam, elas teriam dito cavalos mais rápidos.", author: "Henry Ford" },
  { text: "Acreditar que você pode fazer algo é a primeira etapa do sucesso.", author: "Henry Ford" },
  { text: "Cultura come estratégia no café da manhã.", author: "Peter Drucker" },
  { text: "O que não é medido não é gerenciado.", author: "Peter Drucker" },
  { text: "Eficiência é fazer as coisas certo; eficácia é fazer as coisas certas.", author: "Peter Drucker" },
  { text: "A melhor maneira de ter uma boa ideia é ter muitas ideias.", author: "Linus Pauling" },
  { text: "Os dados são o novo petróleo.", author: "Clive Humby" },
  { text: "Sem dados, você é só mais uma pessoa com uma opinião.", author: "W. Edwards Deming" },
  { text: "Feito é melhor que perfeito.", author: "Sheryl Sandberg" },
  { text: "Se você não está disposto a arriscar o incomum, terá que se conformar com o comum.", author: "Jim Rohn" },
  { text: "O maior risco é não correr nenhum risco.", author: "Mark Zuckerberg" },
  { text: "Sua margem é a minha oportunidade.", author: "Jeff Bezos" },
  { text: "Se você duplicar o número de experimentos que faz por ano, vai duplicar sua inventividade.", author: "Jeff Bezos" },
  { text: "Todo dia é o dia um.", author: "Jeff Bezos" },
  { text: "Comece antes de estar pronto.", author: "Steven Pressfield" },
  { text: "Você perde 100% dos tiros que não dá.", author: "Wayne Gretzky" },
  { text: "O que quer que a mente possa conceber e acreditar, ela pode alcançar.", author: "Napoleon Hill" },
  { text: "Um objetivo bem definido já está pela metade andado.", author: "Napoleon Hill" },
  { text: "Planeje seu trabalho e trabalhe seu plano.", author: "Napoleon Hill" },
  { text: "As pessoas de sucesso encontram maneiras de fazer as coisas darem certo, ao invés de encontrar desculpas.", author: "Anônimo" },
  { text: "Você é a média das cinco pessoas com quem mais convive.", author: "Jim Rohn" },
  { text: "A liderança é a capacidade de transformar visão em realidade.", author: "Warren Bennis" },
  { text: "Trabalho em equipe é a capacidade de trabalhar juntos em direção a uma visão comum.", author: "Andrew Carnegie" },
  { text: "Ninguém se torna rico sozinho.", author: "Andrew Carnegie" },
  { text: "Nenhum de nós é tão inteligente quanto todos nós juntos.", author: "Ken Blanchard" },
  { text: "A qualidade do seu foco determina a qualidade da sua vida.", author: "Robin Sharma" },
  { text: "O único lugar onde seu sonho se torna impossível é na sua própria mente.", author: "Robert Kiyosaki" },
  { text: "Não trabalhe por dinheiro. Faça o dinheiro trabalhar para você.", author: "Robert Kiyosaki" },
  { text: "Os vencedores nunca desistem e os desistentes nunca vencem.", author: "Robert Kiyosaki" },
  { text: "Sonhe grande e ouse falhar.", author: "Norman Vaughan" },
  { text: "Investir em conhecimento rende sempre os melhores juros.", author: "Benjamin Franklin" },
  { text: "O trabalho duro vence o talento quando o talento não trabalha duro.", author: "Tim Notke" },
  { text: "Você não pode usar um relógio de ontem para saber que horas são hoje.", author: "Jim Rohn" },
  { text: "Fortuna favorece a mente preparada.", author: "Louis Pasteur" },
  { text: "A perfeição não é atingível, mas se perseguirmos a perfeição podemos alcançar a excelência.", author: "Vince Lombardi" },
  { text: "Vencer não é tudo, mas a vontade de vencer é tudo.", author: "Vince Lombardi" },
  { text: "Todo grande negócio começou pequeno.", author: "Sam Walton" },
  { text: "Supere as expectativas do seu cliente. Se você fizer isso, ele vai voltar sempre.", author: "Sam Walton" },
  { text: "Seus clientes mais insatisfeitos são sua maior fonte de aprendizado.", author: "Bill Gates" },
  { text: "É bom comemorar o sucesso, mas é mais importante prestar atenção nas lições do fracasso.", author: "Bill Gates" },
  { text: "É preciso 20 anos para construir uma reputação e cinco minutos para destruí-la.", author: "Warren Buffett" },
  { text: "O preço é o que você paga. O valor é o que você recebe.", author: "Warren Buffett" },
  { text: "Não guarde o que sobra depois de gastar; gaste o que sobra depois de guardar.", author: "Warren Buffett" },
  { text: "A melhor propaganda é feita por clientes satisfeitos.", author: "Philip Kotler" },
  { text: "Se você não pode explicar de forma simples, você não entendeu bem o suficiente.", author: "Richard Feynman" },
  { text: "A vida é muito curta para pensar pequeno.", author: "Richard Branson" },
  { text: "O sucesso nos negócios exige treinamento e disciplina e, acima de tudo, trabalho duro.", author: "Richard Branson" },
  { text: "Não aprenda a ter medo de fracassar, aprenda a fracassar rápido e seguir em frente.", author: "Richard Branson" },
  { text: "Todos os nossos sonhos podem se tornar realidade, se tivermos a coragem de persegui-los.", author: "Walt Disney" },
  { text: "A maneira de começar é parar de falar e começar a fazer.", author: "Walt Disney" },
  { text: "É divertido fazer o impossível.", author: "Walt Disney" },
  { text: "Quando algo é importante o suficiente, você faz mesmo que as probabilidades não estejam a seu favor.", author: "Elon Musk" },
  { text: "Persistência é muito importante. Você não deve desistir a menos que seja forçado a desistir.", author: "Elon Musk" },
  { text: "Se as coisas não estão quebrando, você não está inovando o suficiente.", author: "Elon Musk" },
  { text: "Não tenha medo de arriscar mais. Se não arriscar nada, você arrisca ainda mais.", author: "Erin Hanson" },
  { text: "Cada 'não' me aproxima de um 'sim'.", author: "Sara Blakely" },
  { text: "Não tenha medo de falhar. Tenha medo de não tentar.", author: "Sara Blakely" },
  { text: "Grandes conquistas exigem grandes ambições.", author: "Jack Ma" },
  { text: "Se você não desistir, você ainda tem uma chance. Desistir é o maior fracasso.", author: "Jack Ma" },
  { text: "Hoje é difícil, amanhã será pior, mas depois de amanhã será lindo.", author: "Jack Ma" },
  { text: "O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.", author: "Thomas Edison" },
  { text: "Eu não falhei. Só encontrei 10.000 maneiras que não funcionam.", author: "Thomas Edison" },
  { text: "A genialidade é 1% inspiração e 99% transpiração.", author: "Thomas Edison" },
  { text: "Faça o que você faz tão bem que as pessoas vão querer ver de novo, e trazer os amigos.", author: "Walt Disney" },
  { text: "Excelência é a impressão que fica.", author: "Estée Lauder" },
  { text: "Eu não tive um trabalho, tive uma missão.", author: "Estée Lauder" },
  { text: "Grandes líderes não criam seguidores, criam mais líderes.", author: "Tom Peters" },
  { text: "Se você quer ir rápido, vá sozinho. Se você quer ir longe, vá em equipe.", author: "Provérbio africano" },
  { text: "A qualidade nunca é um acidente; é sempre o resultado de um esforço inteligente.", author: "John Ruskin" },
  { text: "A melhor época para plantar uma árvore foi há 20 anos. A segunda melhor época é agora.", author: "Provérbio chinês" },
  { text: "Faça hoje o que os outros não querem, e amanhã você viverá como os outros não podem.", author: "Anônimo" },
  { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
  { text: "Impossível é apenas uma grande palavra usada por gente pequena.", author: "Muhammad Ali" },
  { text: "Eu odiava cada minuto de treino, mas eu disse: não desista. Sofra agora e viva o resto da sua vida como campeão.", author: "Muhammad Ali" },
  { text: "Talento vence jogos, mas trabalho em equipe e inteligência vencem campeonatos.", author: "Michael Jordan" },
  { text: "Eu errei mais de 9 mil arremessos na carreira. Perdi quase 300 jogos. Por isso eu tenho sucesso.", author: "Michael Jordan" },
  { text: "Alguns querem que aconteça, outros desejam que aconteça, outros fazem acontecer.", author: "Michael Jordan" },
  { text: "Somos o que repetidamente fazemos. A excelência, portanto, não é um feito, mas um hábito.", author: "Will Durant" },
  { text: "Comece onde você está. Use o que você tem. Faça o que você pode.", author: "Arthur Ashe" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Grandes coisas nunca vêm da zona de conforto.", author: "Anônimo" },
  { text: "Não julgue cada dia pela colheita que você recolhe, mas pelas sementes que você planta.", author: "Robert Louis Stevenson" },
  { text: "Design não é apenas como algo parece. Design é como algo funciona.", author: "Steve Jobs" },
  { text: "A simplicidade é o último grau de sofisticação.", author: "Leonardo da Vinci" },
  { text: "Todo especialista já foi um iniciante.", author: "Helen Hayes" },
];

/**
 * Retorna a frase "da hora" (UTC) — determinística: a mesma frase aparece
 * pra todo mundo durante a mesma hora, e muda sozinha quando a hora vira.
 */
export function getQuoteForNow(now: Date = new Date()): Quote {
  const hourBucket = Math.floor(now.getTime() / (60 * 60 * 1000));
  const index = ((hourBucket % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[index];
}
