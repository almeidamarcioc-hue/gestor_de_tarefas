import React, { useState, useEffect } from 'react';

const API_URL = '/api';

const getLocalData = (key, defaultValue) => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
};

const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

function App() {
    const [tasks, setTasks] = useState(() => getLocalData('tasks-app-data-v4', []));
    const [destinations, setDestinations] = useState([]);
    const [history, setHistory] = useState([]);
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [schedule, setSchedule] = useState('');
    const [reminderNote, setReminderNote] = useState('');
    const [selectedDestinationId, setSelectedDestinationId] = useState('');
    const [mentionAll, setMentionAll] = useState(false);
    const [serverError, setServerError] = useState(false);
    const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' ou 'history'

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [destRes, histRes] = await Promise.all([
                    fetch(`${API_URL}/destinations`),
                    fetch(`${API_URL}/schedules/history`)
                ]);

                if (!destRes.ok || !histRes.ok) throw new Error('Falha na comunicação com o servidor.');

                const destData = await destRes.json();
                const histData = await histRes.json();

                setDestinations(destData);
                setHistory(histData);
                setServerError(false);
                
                if (destData.length > 0) {
                    setSelectedDestinationId(destData[0].id);
                }
            } catch (error) {
                console.error(error);
                setServerError(true);
            }
        };
        fetchData();
    }, []);

    useEffect(() => { localStorage.setItem('tasks-app-data-v4', JSON.stringify(tasks)); }, [tasks]);

    const showTempMessage = (setter, message) => {
        setter(message);
        setTimeout(() => setter(''), 4000);
    };

    const clearForm = () => {
        setTitle(''); setSubject(''); setEditingTaskId(null); setError(''); setSchedule(''); setReminderNote(''); setMentionAll(false);
    };

    const handleSelectTask = (task) => {
        if (editingTaskId === task.id) {
            clearForm();
        } else {
            setEditingTaskId(task.id);
            setTitle(task.title);
            setSubject(task.subject);
            
            const scheduledInfo = history.find(h => h.id === task.id && h.status === 'PENDING');
            setSchedule(scheduledInfo ? new Date(scheduledInfo.scheduleTime).toISOString().substring(0, 16) : '');
            setReminderNote(scheduledInfo ? scheduledInfo.message.split('*A Fazer:*\n')[1]?.split('\n\n---')[0] || '' : '');
            setSelectedDestinationId(scheduledInfo ? scheduledInfo.destinationId : (destinations.length > 0 ? destinations[0].id : ''));
            setMentionAll(scheduledInfo ? scheduledInfo.mentionAll : false);
        }
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) { setError("O título não pode estar vazio."); return; }
        const now = new Date().toISOString();
        let updatedTasks;
        if (editingTaskId) {
            updatedTasks = tasks.map(t => t.id === editingTaskId ? { ...t, title, subject, updatedAt: now } : t);
        } else {
            const newTask = { id: crypto.randomUUID(), title, subject, createdAt: now, updatedAt: now };
            updatedTasks = [newTask, ...tasks];
        }
        setTasks(updatedTasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        clearForm();
    };

    const handleDeleteTask = (taskId) => {
        setTasks(tasks.filter(task => task.id !== taskId));
        fetch(`${API_URL}/schedule/${taskId}`, { method: 'DELETE' });
        if (editingTaskId === taskId) clearForm();
    };

    const handleSchedule = async () => {
        if (!editingTaskId || !schedule || !selectedDestinationId) { 
            showTempMessage(setError, "Preencha a data e selecione um destino para agendar."); return; 
        }
        if (new Date(schedule) < new Date()) { showTempMessage(setError, "A data do lembrete deve ser no futuro."); return; }
        
        setError('');
        const reminderDate = new Date(schedule);
        const taskToUpdate = tasks.find(t => t.id === editingTaskId);
        const message = `*Lembrete: ${taskToUpdate.title}* 📝\n\n${reminderNote ? `*A Fazer:*
${reminderNote}

` : ''}---
*Assunto Principal:*
${taskToUpdate.subject || '(Sem detalhes)'}`;

        try {
            const response = await fetch(`${API_URL}/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingTaskId, scheduleTime: reminderDate.toISOString(), destinationId: selectedDestinationId, message, mentionAll }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao comunicar com o servidor.');
            }

            // Atualiza o histórico para refletir o novo agendamento
            const newHistoryEntry = { id: editingTaskId, scheduleTime: reminderDate.toISOString(), destinationId: selectedDestinationId, message, mentionAll, status: 'PENDING' };
            setHistory([newHistoryEntry, ...history.filter(h => h.id !== editingTaskId)]);

            showTempMessage(setConfirmation, 'Lembrete agendado com sucesso!');
        } catch (err) {
            showTempMessage(setError, err.message || 'Erro ao agendar.');
        }
    };

    const handleCancelSchedule = async (taskId) => {
        const id = taskId || editingTaskId;
        try {
            await fetch(`${API_URL}/schedule/${id}`, { method: 'DELETE' });
            setHistory(history.map(h => h.id === id ? { ...h, status: 'CANCELLED' } : h));
            if (id === editingTaskId) { setSchedule(''); setReminderNote(''); }
            showTempMessage(setConfirmation, 'Agendamento cancelado.');
        } catch (err) {
            showTempMessage(setError, 'Erro ao cancelar.');
        }
    };

    const filteredTasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.subject && task.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const StatusIndicator = ({ status }) => {
        const styles = {
            PENDING: 'bg-yellow-500 text-yellow-900',
            SENT: 'bg-green-500 text-green-900',
            CANCELLED: 'bg-zinc-500 text-zinc-900',
            FAILED: 'bg-red-500 text-red-900',
        };
        const text = {
            PENDING: 'Pendente',
            SENT: 'Enviado',
            CANCELLED: 'Cancelado',
            FAILED: 'Falhou',
        }
        return <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles[status]}`}>{text[status]}</span>;
    };

    return (
        <div className="bg-zinc-950 text-zinc-100 min-h-screen font-sans antialiased">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                {serverError && ( <div className="bg-red-900/50 border border-red-500/30 text-white text-center p-4 rounded-xl mb-10 shadow-lg"><p className="font-bold text-lg text-red-300">Falha na Conexão com o Servidor</p><p className="text-sm mt-1 text-red-300/80">Verifique se o servidor <code className="bg-black/50 px-2 py-1 rounded">npm start</code> está em execução e atualize a página.</p></div> )}
                <header className="text-center mb-12">
                    <h1 className="text-5xl sm:text-6xl font-bold text-white">Gestor de Tarefas</h1>
                    <p className="text-zinc-400 mt-3 text-lg">A sua base de conhecimento com lembretes automáticos via Google Chat.</p>
                </header>
                <main className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
                    <section className="mb-10 lg:mb-0">
                        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-2xl shadow-black/20">
                            <h2 className="text-2xl font-semibold text-white mb-5">{editingTaskId ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div><input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:outline-none focus:border-sky-500 transition-all"/></div>
                                <div><textarea id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto..." rows="5" className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:outline-none focus:border-sky-500 transition-all resize-y"></textarea></div>
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-sky-900/50">{editingTaskId ? 'Guardar Alterações' : 'Criar Anotação'}</button>
                                    {editingTaskId && <button type="button" onClick={clearForm} className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-bold py-3 px-4 rounded-lg transition">Nova Anotação</button>}
                                </div>
                                {error && <p className="text-red-400 text-sm pt-2 text-center">{error}</p>}
                                {confirmation && <p className="text-green-400 text-sm pt-2 text-center">{confirmation}</p>}
                            </form>
                        </div>
                        {editingTaskId && (
                            <div className="mt-6 bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-2xl shadow-black/20 space-y-4">
                                <div>
                                    <label htmlFor="schedule" className="block text-base font-medium text-zinc-200 mb-2">Agendar Envio Automático</label>
                                    <input id="schedule" type="datetime-local" value={schedule} onChange={e => setSchedule(e.target.value)} className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-2 text-white placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:outline-none focus:border-sky-500 transition-all"/>
                                    <div className="mt-3"><textarea id="reminderNote" value={reminderNote} onChange={e => setReminderNote(e.target.value)} placeholder="O que precisa de ser feito? (opcional)" rows="2" className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-2 text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:outline-none focus:border-sky-500 transition-all resize-y"></textarea></div>
                                    <div className="mt-3">
                                        <select id="gchat_space" value={selectedDestinationId} onChange={e => setSelectedDestinationId(e.target.value)} className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-sky-500 focus:outline-none focus:border-sky-500 transition-all">
                                            {serverError ? <option value="">Erro no servidor</option> : (destinations.length === 0 ? <option value="">A carregar...</option> : destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>))}
                                        </select>
                                    </div>
                                    <div className="flex items-center mt-4">
                                        <input id="mentionAll" type="checkbox" checked={mentionAll} onChange={e => setMentionAll(e.target.checked)} className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-600"/>
                                        <label htmlFor="mentionAll" className="ml-2 block text-sm text-zinc-300">Mencionar @todos no espaço</label>
                                    </div>
                                    <button onClick={handleSchedule} className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white font-bold p-3 px-4 rounded-lg transition">Agendar Envio</button>
                                    {history.find(h => h.id === editingTaskId && h.status === 'PENDING') && (<div className="text-xs text-yellow-400 mt-2 flex justify-between items-center"><span>Envio pendente para: {formatDate(schedule)}</span><button onClick={() => handleCancelSchedule()} className="text-xs text-red-400 hover:underline">Cancelar</button></div>)}
                                </div>
                            </div>
                        )}
                    </section>
                    
                    <section>
                        <div className="flex border-b border-zinc-800 mb-4">
                            <button onClick={() => setActiveTab('tasks')} className={`py-2 px-4 font-medium transition ${activeTab === 'tasks' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-zinc-400 hover:text-white'}`}>Anotações</button>
                            <button onClick={() => setActiveTab('history')} className={`py-2 px-4 font-medium transition ${activeTab === 'history' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-zinc-400 hover:text-white'}`}>Histórico de Envios</button>
                        </div>
                        {activeTab === 'tasks' && (
                            <>
                                <div className="mb-4"><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar anotações..." className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-lg p-4 text-white placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:outline-none focus:border-sky-500 transition-all"/></div>
                                <div className="space-y-3 h-[60vh] overflow-y-auto pr-2 task-list-scrollbar">
                                    {filteredTasks.length > 0 ? filteredTasks.map(task => (
                                        <div key={task.id} onClick={() => handleSelectTask(task)} className={`p-4 rounded-lg flex justify-between items-center cursor-pointer transition-all duration-200 ${editingTaskId === task.id ? 'bg-sky-900/40 ring-2 ring-sky-500' : 'bg-zinc-900 hover:bg-zinc-800/50'}`}>
                                            <div className="overflow-hidden"><h3 className="font-bold text-lg text-white truncate">{task.title}</h3><div className="text-xs text-zinc-400"><span>Última edição: {formatDate(task.updatedAt)}</span></div></div>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-zinc-500 hover:text-red-400 p-2 rounded-full transition flex-shrink-0"><TrashIcon /></button>
                                        </div>
                                    )) : (<div className="text-center text-zinc-500 p-8 bg-zinc-900/50 rounded-lg"><p>Nenhuma anotação encontrada.</p></div>)}
                                </div>
                            </>
                        )}
                        {activeTab === 'history' && (
                            <div className="space-y-3 h-[65vh] overflow-y-auto pr-2 task-list-scrollbar">
                                {history.length > 0 ? history.map(h => {
                                    const relatedTask = tasks.find(t => t.id === h.id);
                                    return (
                                        <div key={h.id + h.scheduleTime} className="p-4 rounded-lg bg-zinc-900 flex justify-between items-start">
                                            <div className="overflow-hidden">
                                                <h3 className="font-bold text-md text-zinc-200 truncate">{relatedTask ? relatedTask.title : 'Anotação Apagada'}</h3>
                                                <div className="text-xs text-zinc-400 mt-1"><span>Para: {destinations.find(d => d.id === h.destinationId)?.name || 'Desconhecido'}</span></div>
                                                <div className="text-xs text-zinc-400"><span>Em: {formatDate(h.scheduleTime)}</span></div>
                                            </div>
                                            <div className="flex-shrink-0"><StatusIndicator status={h.status} /></div>
                                        </div>
                                    )
                                }) : (<div className="text-center text-zinc-500 p-8 bg-zinc-900/50 rounded-lg"><p>Nenhum envio no histórico.</p></div>)}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}

export default App;