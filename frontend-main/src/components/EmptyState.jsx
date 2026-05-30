import React from 'react';
import { Package, Search, ShoppingCart, FileText } from 'lucide-react';

const EmptyState = ({ type = 'default', title, message, action, onAction }) => {
  const getIcon = () => {
    switch (type) {
      case 'products': return Package;
      case 'search': return Search;
      case 'cart': return ShoppingCart;
      case 'orders': return FileText;
      default: return Package;
    }
  };

  const Icon = getIcon();

  const defaultContent = {
    products: { title: 'No Products', message: 'There are no products available at this time.' },
    search: { title: 'No Results', message: 'No items match your search criteria.' },
    cart: { title: 'Cart is Empty', message: 'Add some items to your cart to get started.' },
    orders: { title: 'No Orders', message: 'You haven\'t placed any orders yet.' },
    default: { title: 'Nothing Here', message: 'There\'s nothing to display at the moment.' }
  };

  const content = defaultContent[type] || defaultContent.default;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-6 bg-dark-800 rounded-full mb-6">
        <Icon className="w-12 h-12 text-dark-500" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title || content.title}</h3>
      <p className="text-dark-400 max-w-sm mb-6">{message || content.message}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-cyan-600 hover:to-cyan-700 transition-all"
        >
          {action}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
