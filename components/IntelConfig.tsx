import React, { useState } from 'react';
import { Settings, Shield, Key, BarChart3, Users, Save, AlertCircle } from 'lucide-react';

const IntelConfig: React.FC = () => {
    const [apiKey, setApiKey] = useState('••••••••••••••••');
    const [showKey, setShowKey] = useState(false);

    return (
        <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* API Configuration */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Key size={18} className="text-brand-600" /> Configuração do Motor Anthropic
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Anthropic API Key</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    type={showKey ? "text" : "password"} 
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full bg-gray-50 border-gray-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 py-2 pl-3 pr-10"
                                />
                                <button 
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <Settings size={14} />
                                </button>
                            </div>
                            <button className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-brand-700 transition-colors">
                                <Save size={16} /> Salvar
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 italic">
                           <Shield size={10} /> Gerenciado via Secret Manager. Alterar aqui atualizará o ambiente de produção.
                        </p>
                    </div>
                </div>
            </div>

            {/* Consumption Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <BarChart3 size={18} className="text-blue-600" /> Consumo de Tokens (Est.)
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Uso no Período</span>
                            <span className="font-bold text-gray-900">42.5k / 100k</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full w-[42.5%]" />
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-400">Custo Ref.</span>
                            <span className="text-blue-600 font-bold">$0.64 USD</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <Users size={18} className="text-brand-600" /> Atribuição de Funções
                    </h3>
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500 mb-2">Configure quem pode visualizar ou analisar dados de inteligência no sistema.</p>
                        <button className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-bold text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-all flex items-center justify-center gap-2">
                             Gerenciar Membros Intel <Users size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Logs Placeholder */}
            <div className="bg-red-50/50 rounded-xl border border-red-100 p-6">
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2 mb-3">
                    <AlertCircle size={18} /> Logs de Erro de IA (Últimas 24h)
                </h3>
                <div className="text-[10px] text-red-700 italic">
                    Nenhum erro crítico registrado no intervalo selecionado. Sistema operacional.
                </div>
            </div>
        </div>
    );
};

export default IntelConfig;
