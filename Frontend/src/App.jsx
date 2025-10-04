import React, { useState, useEffect } from 'react';

// --- PROTÓTIPO FRONTEND ---
// Versão com design refinado.
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
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// Ícones SVG como componentes para melhor controle
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

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
        // Se a tarefa já estiver selecionada, deselecione-a
        if (editingTaskId === task.id) {
            clearForm();
        } else {
            setEditingTaskId(task.id);
            setTitle(task.title);
            setSubject(task.subject);
        }
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
            const updatedTasks = tasks.map(task =>
                task.id === editingTaskId ? { ...task, title, subject, updatedAt: now } : task
            );
            setTasks(updatedTasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        } else {
            const newTask = { id: crypto.randomUUID(), title, subject, createdAt: now, updatedAt: now };
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

    // Função para enviar notificação via WhatsApp
    const sendWhatsAppNotification = () => {
        const task = tasks.find(t => t.id === editingTaskId);
        if (!task) return;

        if (!phoneNumber || phoneNumber.length < 10) {
            setError("Para enviar um lembrete, insira um número de WhatsApp válido.");
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
    
    const currentTask = tasks.find(t => t.id === editingTaskId);

    return (
        <div className="bg-zinc-900 text-white min-h-screen font-sans antialiased">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-bold text-sky-400">Task-Zap</h1>
                    <p className="text-zinc-400 mt-2">Sua base de conhecimento com lembretes via WhatsApp.</p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
                    <section className="mb-10 lg:mb-0">
                         <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                             <h2 className="text-2xl font-semibold text-white mb-4">{editingTaskId ? 'Editando Anotação' : 'Nova Anotação'}</h2>
                             <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="title" className="sr-only">Título</label>
                                    <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full bg-zinc-700 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-shadow"/>
                                </div>
                                <div>
                                    <label htmlFor="subject" className="sr-only">Assunto</label>
                                    <textarea id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto..." rows="5" className="w-full bg-zinc-700 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-sky-500 focus:outline-none resize-y transition-shadow"></textarea>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-sky-900/50">
                                        {editingTaskId ? 'Salvar Alterações' : 'Criar Anotação'}
                                    </button>
                                    {editingTaskId && (
                                        <button type="button" onClick={clearForm} className="w-full bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded-lg transition">Novo</button>
                                    )}
                                </div>
                                {error && <p className="text-red-400 text-sm pt-2 text-center">{error}</p>}
                             </form>
                         </div>
                         {editingTaskId && (
                           <div className="mt-4 bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex flex-col sm:flex-row items-center gap-4">
                               <div className='flex-1'>
                                    <label htmlFor="phone" className="block text-sm font-medium text-zinc-300 mb-2">Seu WhatsApp para lembretes</label>
                                    <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Ex: 5511999998888" className="w-full bg-zinc-700 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:ring-2 focus:ring-sky-500 focus:outline-none"/>
                               </div>
                               <button type="button" onClick={sendWhatsAppNotification} className="w-full sm:w-auto mt-2 sm:mt-0 self-end bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-10 rounded-lg transition">Lembrar</button>
                           </div>
                         )}
                    </section>
                    
                    <section>
                        <div className="mb-4">
                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar anotações..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white placeholder-zinc-400 focus:ring-2 focus:ring-sky-500 focus:outline-none"/>
                        </div>
                        <div className="space-y-3 h-[60vh] overflow-y-auto pr-2">
                            {filteredTasks.length > 0 ? (
                                filteredTasks.map(task => (
                                    <div key={task.id} onClick={() => handleSelectTask(task)} className={`p-4 rounded-lg flex justify-between items-center cursor-pointer transition-all duration-200 ${editingTaskId === task.id ? 'bg-sky-900/50 ring-2 ring-sky-500' : 'bg-zinc-800 hover:bg-zinc-700/50'}`}>
                                        <div className="overflow-hidden">
                                            <h3 className="font-bold text-lg text-white truncate">{task.title}</h3>
                                            <div className="text-xs text-zinc-400">
                                                <span>Última edição: {formatDate(task.updatedAt)}</span>
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-zinc-500 hover:text-red-400 p-2 rounded-full transition flex-shrink-0"><TrashIcon /></button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-zinc-500 p-8 bg-zinc-800/50 rounded-lg">
                                    <p>Nenhuma anotação encontrada.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

