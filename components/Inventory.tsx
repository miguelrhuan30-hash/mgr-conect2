import React from 'react';
import { Package, Search } from 'lucide-react';

const Inventory: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de Estoque</h1>
          <p className="text-gray-500">Gestão de equipamentos e materiais.</p>
        </div>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium">
          Solicitar Material
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar item..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <select className="border border-gray-300 rounded-lg text-sm px-4 py-2 bg-white">
            <option>Todas Categorias</option>
            <option>EPIs</option>
            <option>Ferramentas</option>
            <option>Eletrônicos</option>
          </select>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd.</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Mock Data */}
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-brand-100 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-brand-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">Capacete de Segurança</div>
                    <div className="text-sm text-gray-500">MGR-EPI-001</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">EPI-001</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">EPI</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">45</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Em Estoque
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;