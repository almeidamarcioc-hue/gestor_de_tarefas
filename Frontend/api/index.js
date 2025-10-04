// Carrega as variáveis de ambiente do ficheiro .env
require('dotenv').config();

// VERIFICAÇÃO CRÍTICA: Garante que a variável da base de dados foi carregada
if (!process.env.DATABASE_URL) {
    console.error("\x1b[31m%s\x1b[0m", "ERRO FATAL: A variável de ambiente DATABASE_URL não foi encontrada.");
    console.error("Por favor, certifique-se que tem um ficheiro .env na pasta do backend com o seguinte conteúdo:");
    console.error('\x1b[33m%s\x1b[0m', 'DATABASE_URL="seu_url_de_conexao_neon"');
    process.exit(1); // Para a execução se a variável não estiver definida
}

// Importa as bibliotecas necessárias
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Cliente PostgreSQL

// Cria a aplicação Express
const app = express();
const port = 3001;

// --- CONFIGURAÇÃO IMPORTANTE ---
const WEBHOOKS = {
  "Notificações": "https://chat.googleapis.com/v1/spaces/AAQABLwAh7c/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mH-x4KwE9JQpBhJPjxBVqTz91CkptWEesCQ6-w-MRAg",
};

// Configuração da ligação à base de dados Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Armazena os agendamentos ativos em memória.
const scheduledTasks = new Map();

// Middlewares
app.use(cors());
app.use(express.json());

// Função encapsulada para agendar o envio
const scheduleMessage = (id, scheduleTime, destinationId, message, mentionAll) => {
    const delay = new Date(scheduleTime).getTime() - Date.now();
    if (delay <= 0) return;

    const webhookUrl = WEBHOOKS[destinationId];
    if (!webhookUrl) return;

    const timeoutId = setTimeout(async () => {
        const finalMessage = mentionAll ? `<users/all> ${message}` : message;

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                body: JSON.stringify({ text: finalMessage }),
            });
            const status = response.ok ? 'SENT' : 'FAILED';
            await pool.query('UPDATE schedules SET status = $1 WHERE id = $2', [status, id]);
            console.log(`Mensagem para a tarefa ${id} enviada. Estado: ${status}`);
        } catch (error) {
            console.error('Erro de rede ao enviar para o Google Chat:', error);
            await pool.query('UPDATE schedules SET status = $1 WHERE id = $2', ['FAILED', id]);
        }
        
        scheduledTasks.delete(id);
    }, delay);
    
    scheduledTasks.set(id, timeoutId);
    console.log(`Tarefa ${id} agendada para ${new Date(scheduleTime).toLocaleString()}`);
};

// Função para reagendar tarefas pendentes ao iniciar o servidor
const reschedulePendingTasks = async () => {
    try {
        const { rows } = await pool.query("SELECT * FROM schedules WHERE status = 'PENDING'");
        const now = Date.now();
        console.log(`Encontradas ${rows.length} tarefas pendentes para reagendar.`);
        
        for (const task of rows) {
            if (new Date(task.schedule_time).getTime() > now) {
                scheduleMessage(task.id, task.schedule_time, task.destination_id, task.message, task.mention_all);
            } else {
                await pool.query("UPDATE schedules SET status = 'FAILED' WHERE id = $1", [task.id]);
            }
        }
    } catch (error) {
        console.error("Erro ao reagendar tarefas pendentes:", error);
    }
};

// --- ROTAS DA API ---

app.get('/destinations', (req, res) => {
  const destinationList = Object.keys(WEBHOOKS).map(key => ({ id: key, name: key }));
  res.json(destinationList);
});

app.get('/schedules/history', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM schedules ORDER BY schedule_time DESC');
        // Mapeia os nomes das colunas para os nomes esperados pelo frontend
        const history = rows.map(row => ({
            id: row.id,
            scheduleTime: row.schedule_time,
            destinationId: row.destination_id,
            message: row.message,
            mentionAll: row.mention_all,
            status: row.status
        }));
        res.json(history);
    } catch (error) {
        console.error("Erro ao obter o histórico:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

app.post('/schedule', async (req, res) => {
  console.log('Recebido pedido para /schedule com o corpo:', req.body);
  const { id, scheduleTime, destinationId, message, mentionAll } = req.body;

  if (!id || !scheduleTime || !destinationId || !message) {
    return res.status(400).json({ error: 'Dados em falta no pedido.' });
  }
  if (!WEBHOOKS[destinationId]) {
    return res.status(400).json({ error: `ID de destino '${destinationId}' não foi encontrado na configuração do servidor.` });
  }

  try {
    // Usa UPSERT (INSERT ... ON CONFLICT ... DO UPDATE) para inserir ou atualizar o agendamento
    const query = `
        INSERT INTO schedules (id, schedule_time, destination_id, message, mention_all, status)
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
        ON CONFLICT (id) DO UPDATE SET
            schedule_time = EXCLUDED.schedule_time,
            destination_id = EXCLUDED.destination_id,
            message = EXCLUDED.message,
            mention_all = EXCLUDED.mention_all,
            status = 'PENDING';
    `;
    await pool.query(query, [id, scheduleTime, destinationId, message, mentionAll]);
    
    if (scheduledTasks.has(id)) clearTimeout(scheduledTasks.get(id));
    scheduleMessage(id, scheduleTime, destinationId, message, mentionAll);

    res.status(200).json({ success: true, message: 'Agendamento recebido com sucesso.' });
  } catch (error) {
    console.error("Erro ao agendar na base de dados:", error);
    res.status(500).json({ error: 'Erro ao guardar o agendamento.' });
  }
});

app.delete('/schedule/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (scheduledTasks.has(id)) {
      clearTimeout(scheduledTasks.get(id));
      scheduledTasks.delete(id);
    }
    await pool.query("UPDATE schedules SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING'", [id]);
    console.log(`Agendamento para a tarefa ${id} cancelado.`);
    res.status(200).send('Agendamento cancelado com sucesso.');
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    res.status(500).json({ error: 'Erro ao cancelar.' });
  }
});

// Inicia o servidor
app.listen(port, async () => {
  console.log(`Servidor à escuta na porta ${port}`);
  try {
    await pool.query('SELECT NOW()');
    console.log('\x1b[32m%s\x1b[0m', 'Ligado à base de dados Neon com sucesso!');
    reschedulePendingTasks();
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Falha ao ligar à base de dados Neon:', error.message);
  }
});

