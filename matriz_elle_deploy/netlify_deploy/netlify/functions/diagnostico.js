exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { notas } = JSON.parse(event.body);

    const pilares = [
      'Clareza interna',
      'Regulação emocional',
      'Medo de julgamento',
      'Autorização interna',
      'Assertividade prática',
      'Limites e posicionamento',
      'Presença e linguagem',
      'Consistência',
    ];

    const resumo = pilares.map((p, i) => `${p}: ${notas[i]}/10`).join('\n');
    const critico = notas.indexOf(Math.min(...notas));
    const forte = notas.indexOf(Math.max(...notas));

    const prompt = `Você é Fran Castro, Arquiteta da Inteligência Emocional, criadora do Método ELLE e do programa Arquitetura da Voz — 21 dias para parar de se diminuir e sustentar sua voz.

Uma aluna acabou de preencher a Matriz ELLE de Sustentação da Voz com as seguintes notas:

${resumo}

Eixo mais crítico: ${pilares[critico]} (${notas[critico]}/10)
Eixo mais forte: ${pilares[forte]} (${notas[forte]}/10)

Escreva um diagnóstico personalizado com no máximo 4 parágrafos curtos. Use a voz de Fran Castro — próxima, direta, sem motivação vazia, sem elogios gratuitos.

O diagnóstico deve:
1. Nomear o padrão geral que as notas revelam — não liste as notas, interprete o conjunto
2. Destacar o eixo mais crítico e o que ele revela sobre a comunicação dela
3. Reconhecer o eixo mais forte como base para construir
4. Terminar com uma orientação específica para os 21 dias com base nesse perfil

Tom: como se Fran estivesse olhando para os dados e falando diretamente com ela. Sem "parabéns por", sem "você é incrível". Preciso, humano, com peso real.

Responda apenas o texto do diagnóstico, sem título, sem introdução.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const texto = data.content.map(i => i.text || '').join('');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ diagnostico: texto }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro ao gerar diagnóstico.' }),
    };
  }
};
