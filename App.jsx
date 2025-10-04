import React, { useState, useEffect } from 'react';

// --- PROTÓTIPO FRONTEND ---
// Este componente simula a aplicação completa, mas sem backend.
// As tarefas são salvas no localStorage do seu navegador para persistência.

// Função para obter as tarefas salvas localmente
const getLocalTasks = () => {
    const savedTasks = localStorage.getItem('tasks-app-data');
    if (savedTasks) {
        const tasks = JSON.parse(savedTasks);
        return tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return [];
};

// Função para formatar datas para exibição
const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Componente principal da aplicação
export default function App() {
    // Estados para gerenciar os dados da aplicação
    const [tasks, setTasks] = useState(getLocalTasks);
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(() => localStorage.getItem('whatsapp-todo-phone') || '');
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingTaskId, setEditingTaskId] = useState(null); // Controla qual tarefa está em edição

    // Efeito para salvar as tarefas no localStorage sempre que a lista for alterada
    useEffect(() => {
        localStorage.setItem('tasks-app-data', JSON.stringify(tasks));
    }, [tasks]);

    // Salva o número de telefone no localStorage sempre que ele mudar
    useEffect(() => {
        localStorage.setItem('whatsapp-todo-phone', phoneNumber);
    }, [phoneNumber]);

    // Função para limpar o formulário e sair do modo de edição
    const clearForm = () => {
        setTitle('');
        setSubject('');
        setEditingTaskId(null);
        setError('');
    };

    // Função para selecionar uma tarefa para edição
    const handleSelectTask = (task) => {
        setEditingTaskId(task.id);
        setTitle(task.title);
        setSubject(task.subject);
    };

    // Função para lidar com a submissão do formulário (criar ou atualizar)
    const handleSubmit = (e) => {
        e.preventDefault();
        if (title.trim() === '') {
            setError("O título não pode estar vazio.");
            return;
        }

        const now = new Date().toISOString();

        if (editingTaskId) {
            // Atualizar tarefa existente
            const updatedTasks = tasks.map(task =>
                task.id === editingTaskId ? { ...task, title, subject, updatedAt: now } : task
            );
            setTasks(updatedTasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        } else {
            // Criar nova tarefa
            const newTask = {
                id: crypto.randomUUID(),
                title,
                subject,
                createdAt: now,
                updatedAt: now,
            };
            setTasks([newTask, ...tasks]);
        }
        clearForm();
    };
    
    // Função para deletar uma tarefa
    const handleDeleteTask = (taskId) => {
        setTasks(tasks.filter(task => task.id !== taskId));
        if (editingTaskId === taskId) {
            clearForm();
        }
    };

    // Função para enviar notificação via WhatsApp para a tarefa selecionada
    const sendWhatsAppNotification = () => {
        const task = tasks.find(t => t.id === editingTaskId);
        if (!task) return;

        if (!phoneNumber || phoneNumber.length < 10) {
            setError("Para enviar um lembrete, insira um número de WhatsApp válido acima.");
            return;
        }
        setError('');

        const message = `*Lembrete de Tarefa!* 📝\n\n*Título:* ${task.title}\n*Assunto:* ${task.subject || 'Nenhum assunto.'}`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
    };

    // Filtra as tarefas com base no termo de pesquisa
    const filteredTasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.subject && task.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="bg-slate-900 text-white min-h-screen font-sans p-4">
            <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-4xl mx-auto border border-slate-700">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-cyan-400">Task-Zap</h1>
                    <p className="text-slate-400 mt-2">Sua base de conhecimento pessoal com lembretes no WhatsApp.</p>
                </header>

                <div className="mb-6">
                     <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">Seu número de WhatsApp (para lembretes)</label>
                     <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Ex: 5511999998888" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                </div>

                <form onSubmit={handleSubmit} className="mb-6 bg-slate-900/50 p-6 rounded-lg space-y-4">
                    <h2 className="text-2xl font-semibold text-white">{editingTaskId ? 'Editando Tarefa' : 'Nova Tarefa'}</h2>
                    <div>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                    </div>
                    <div>
                        <textarea value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto..." rows="4" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y"></textarea>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
                            {editingTaskId ? 'Salvar Alterações' : 'Criar Tarefa'}
                        </button>
                        {editingTaskId && (
                            <>
                                <button type="button" onClick={sendWhatsAppNotification} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition">Gerar Lembrete</button>
                                <button type="button" onClick={clearForm} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition">Cancelar</button>
                            </>
                        )}
                    </div>
                    {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
                </form>

                <div className="border-t border-slate-700 pt-6">
                     <input id="search" type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar tarefas..." className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white mb-4 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                     
                     <div className="space-y-3">
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map(task => (
                                <div key={task.id} onClick={() => handleSelectTask(task)} className={`p-4 rounded-lg flex justify-between items-center cursor-pointer transition-all duration-200 ${editingTaskId === task.id ? 'bg-cyan-900/50 ring-2 ring-cyan-500' : 'bg-slate-700 hover:bg-slate-600/50'}`}>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">{task.title}</h3>
                                        <div className="text-xs text-slate-400 flex flex-col sm:flex-row sm:gap-4">
                                            <span>Criado em: {formatDate(task.createdAt)}</span>
                                            <span>Editado em: {formatDate(task.updatedAt)}</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-slate-500 hover:text-red-400 p-2 rounded-full transition"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-slate-500 p-8 bg-slate-700/50 rounded-lg">
                                <p>Nenhuma tarefa encontrada.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Para o Tailwind CSS funcionar, adicione este script no seu `index.html`
// <script src="https://cdn.tailwindcss.com"></script>

