import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { X, Plus, Edit, Trash2, Search, Package, Loader2 } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Isolated Add/Edit form. Owns all input state locally so typing does NOT re-render
// the parent ProductDialog (which holds the large products table). Before this split,
// every keystroke reconciled all product rows and their toggle buttons.
const ProductForm = memo(({ editingProduct, onSave, onCancel, isSaving }) => {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [promoPrice, setPromoPrice] = useState('');

  // When parent selects a product for editing, hydrate local form state once.
  useEffect(() => {
    if (editingProduct) {
      setProductName(editingProduct.name || '');
      setDescription(editingProduct.description || '');
      setPrice(editingProduct.price ?? '');
      setStock(editingProduct.stock ?? '');
      setPromoPrice(editingProduct.promoPrice ?? '');
    } else {
      setProductName('');
      setDescription('');
      setPrice('');
      setStock('');
      setPromoPrice('');
    }
  }, [editingProduct]);

  const handleSubmit = () => {
    if (!productName || !description || price === '' || stock === '') {
      Swal.fire({ title: 'Validation Error', text: 'Please fill in all fields', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    onSave({
      id: editingProduct?.id || null,
      name: productName,
      description,
      price: parseFloat(price),
      stock: parseInt(stock, 10),
      promoPrice: promoPrice !== '' ? parseFloat(promoPrice) : null
    });
  };

  return (
    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/30 ring-1 ring-slate-700/10">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1.5 h-5 rounded-full ${editingProduct ? 'bg-amber-500' : 'bg-cyan-500'}`}></div>
        <h3 className="text-sm font-semibold text-white">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
        {editingProduct && <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">ID #{editingProduct.id}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-1 lg:col-span-2">
          <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-widest">Name</label>
          <input type="text" placeholder="e.g. MTN" value={productName} onChange={(e) => setProductName(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all" />
        </div>
        <div className="col-span-2 sm:col-span-1 lg:col-span-2">
          <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-widest">Description</label>
          <input type="text" placeholder="Product description" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-widest">Price (GHS)</label>
          <input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-widest">Stock</label>
          <input type="number" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-semibold text-orange-400/70 mb-1 uppercase tracking-widest">Promo (GHS)</label>
          <input type="number" placeholder="Optional" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)}
            className="w-full bg-slate-900/50 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:outline-none transition-all" />
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-slate-700/20">
        <button onClick={handleSubmit} disabled={isSaving}
          className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-semibold hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-cyan-500/10 transition-all">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {editingProduct ? 'Update' : 'Add'} Product
        </button>
        {editingProduct && (
          <button onClick={onCancel} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg text-sm font-medium hover:bg-slate-700 hover:text-slate-300 border border-slate-600/30 transition-all">Cancel</button>
        )}
      </div>
    </div>
  );
});

// Isolated search input. Owns its own immediate state + debounces notifying the
// parent (350ms). The table below only re-renders when the debounced value changes,
// not on every keystroke, which keeps typing buttery-smooth.
const SearchInput = memo(({ onSearchChange }) => {
  const [value, setValue] = useState('');
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearchChange(next), 250);
  };

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input type="text" placeholder="Filter by name..." value={value} onChange={handleChange}
        className="w-full bg-slate-900/50 border border-slate-700/40 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all" />
    </div>
  );
});

const getCarrierColor = (name) => {
  const upperName = name?.toUpperCase() || '';
  if (upperName.includes('MTN')) return 'bg-yellow-500';
  if (upperName.includes('TELECEL')) return 'bg-red-500';
  if (upperName.includes('AIRTEL') || upperName.includes('TIGO')) return 'bg-blue-500';
  return 'bg-gray-500';
};

// Memoized row so toggles/handlers don't rebuild on every parent render.
const ProductRow = memo(({ product, idx, onEdit, onDelete, onToggleShop, onToggleShopStock, onSetStock, onToggleAgent, onTogglePromo }) => (
  <tr className={`hover:bg-slate-800/30 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/10'}`}>
    <td className="px-3 py-2.5">
      <span className="text-slate-500 text-xs font-mono">#{product.id}</span>
    </td>
    <td className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ring-2 ring-slate-900 ${getCarrierColor(product.name)}`}></span>
        <span className="text-white font-medium text-xs">{product.name}</span>
      </div>
    </td>
    <td className="px-3 py-2.5 text-slate-400 max-w-[140px] truncate text-xs">{product.description}</td>
    <td className="px-3 py-2.5">
      <div className="flex flex-col">
        <span className={`text-xs font-semibold ${product.usePromoPrice ? 'line-through text-slate-600' : 'text-white'}`}>
          GHS {product.price?.toFixed(2)}
        </span>
        {product.usePromoPrice && product.promoPrice != null && (
          <span className="text-xs font-bold text-orange-400">GHS {product.promoPrice?.toFixed(2)}</span>
        )}
      </div>
    </td>
    <td className="px-3 py-2.5">
      <span className="text-xs text-slate-400">{product.promoPrice != null ? `GHS ${product.promoPrice?.toFixed(2)}` : <span className="text-slate-600">&mdash;</span>}</span>
    </td>
    <td className="px-3 py-2.5 text-center">
      <button onClick={() => onTogglePromo(product.id, product.usePromoPrice)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${product.usePromoPrice ? 'bg-orange-500' : 'bg-slate-700'} ${product.promoPrice == null ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
        disabled={product.promoPrice == null}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${product.usePromoPrice ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}></span>
      </button>
    </td>
    <td className="px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded text-[10px] font-bold ${
          product.stock === 0 ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/20' :
          product.stock < 5 ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20' : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
        }`}>{product.stock}</span>
        <div className="flex gap-0.5">
          <button onClick={() => onSetStock(product.id, 1)} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/15 rounded transition-colors" title="Set to 1">1</button>
          <button onClick={() => onSetStock(product.id, 0)} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-red-400 hover:bg-red-500/15 rounded transition-colors" title="Set to 0">0</button>
        </div>
      </div>
    </td>
    <td className="px-3 py-2.5 text-center">
      <button onClick={() => onToggleShop(product.id, product.showInShop)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${product.showInShop ? 'bg-cyan-500' : 'bg-slate-700'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${product.showInShop ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}></span>
      </button>
    </td>
    <td className="px-3 py-2.5 text-center">
      {product.showInShop ? (
        <button onClick={() => onToggleShopStock(product.id, product.shopStockClosed)}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${product.shopStockClosed ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 ring-1 ring-red-500/20' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20'}`}>
          {product.shopStockClosed ? 'Closed' : 'Open'}
        </button>
      ) : <span className="text-slate-700 text-xs">&mdash;</span>}
    </td>
    <td className="px-3 py-2.5 text-center">
      <button onClick={() => onToggleAgent(product.id, product.showForAgents)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${product.showForAgents ? 'bg-purple-500' : 'bg-slate-700'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${product.showForAgents ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}></span>
      </button>
    </td>
    <td className="px-3 py-2.5">
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => onEdit(product)}
          className="w-7 h-7 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/15 rounded-lg transition-colors" title="Edit">
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(product.id)}
          className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-500/15 rounded-lg transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </td>
  </tr>
));

const ProductDialog = ({ isOpen, onClose }) => {
  const [editingProduct, setEditingProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.name?.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/products`, { headers: getAuthHeaders() });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchProducts();
  }, [isOpen, fetchProducts]);

  const handleSaveProduct = useCallback(async (data) => {
    setIsSaving(true);
    try {
      const productData = {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        promoPrice: data.promoPrice
      };
      if (data.id) {
        await axios.put(`${BASE_URL}/products/update/${data.id}`, productData, { headers: getAuthHeaders() });
        Swal.fire({ title: 'Updated!', text: 'Product updated successfully.', icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500 });
      } else {
        await axios.post(`${BASE_URL}/products/add`, productData, { headers: getAuthHeaders() });
        Swal.fire({ title: 'Success!', text: 'Product added successfully.', icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500 });
      }
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      Swal.fire({ title: 'Error!', text: `Operation failed: ${error.message}`, icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setIsSaving(false);
    }
  }, [fetchProducts]);

  const handleDeleteProduct = useCallback(async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
      background: '#1e293b', color: '#f1f5f9', confirmButtonText: 'Yes, delete it!'
    });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/products/delete/${id}`, { headers: getAuthHeaders() });
        setProducts((prev) => prev.filter((p) => p.id !== id));
        Swal.fire({ title: 'Deleted!', text: 'Product deleted.', icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500 });
      } catch (error) {
        Swal.fire({ title: 'Error!', text: 'Failed to delete product.', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  }, []);

  const handleToggleShop = useCallback(async (id, currentValue) => {
    try {
      await axios.put(`${BASE_URL}/products/toggle-shop/${id}`, { showInShop: !currentValue }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, showInShop: !currentValue } : p)));
    } catch (error) {
      console.error('Error toggling shop visibility:', error);
    }
  }, []);

  const handleToggleShopStock = useCallback(async (id, currentValue) => {
    try {
      await axios.put(`${BASE_URL}/products/update/${id}`, { shopStockClosed: !currentValue }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, shopStockClosed: !currentValue } : p)));
      Swal.fire({
        title: !currentValue ? 'Stock Closed' : 'Stock Opened',
        text: !currentValue ? 'Store customers cannot purchase this product' : 'Store customers can now purchase this product',
        icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false
      });
    } catch (error) {
      console.error('Error toggling shop stock:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to update shop stock status', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, []);

  const handleSetStock = useCallback(async (id, stockValue) => {
    try {
      await axios.put(`${BASE_URL}/products/update/${id}`, { stock: stockValue }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: stockValue } : p)));
      Swal.fire({
        title: 'Stock Updated!', text: `Stock set to ${stockValue}`,
        icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false
      });
    } catch (error) {
      console.error('Error updating stock:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to update stock', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, []);

  const handleBulkSetStock = useCallback(async (carrier, stockValue) => {
    try {
      await axios.patch(`${BASE_URL}/products/bulk-stock-by-carrier`, { carrier, stock: stockValue }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) =>
        p.name?.toUpperCase().includes(carrier.toUpperCase()) ? { ...p, stock: stockValue } : p
      ));
      Swal.fire({
        title: 'Bulk Update!', text: `All ${carrier} products stock set to ${stockValue}`,
        icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false
      });
    } catch (error) {
      console.error('Error bulk updating stock:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to bulk update stock', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, []);

  const handleBulkShopStock = useCallback(async (closeStock) => {
    try {
      await axios.patch(`${BASE_URL}/products/bulk-shop-stock`, { closeStock }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) => (p.showInShop ? { ...p, shopStockClosed: closeStock } : p)));
      Swal.fire({
        title: closeStock ? 'All Shop Stock Closed' : 'All Shop Stock Opened',
        text: closeStock ? 'Store customers cannot purchase any products' : 'Store customers can now purchase products',
        icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false
      });
    } catch (error) {
      console.error('Error bulk updating shop stock:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to update shop stock', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, []);

  const handleToggleAgent = useCallback(async (id, currentValue) => {
    try {
      await axios.put(`${BASE_URL}/products/toggle-agent/${id}`, { showForAgents: !currentValue }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, showForAgents: !currentValue } : p)));
    } catch (error) {
      console.error('Error toggling agent visibility:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to update agent visibility', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, []);

  const handleTogglePromo = useCallback(async (id, currentValue) => {
    try {
      await axios.put(`${BASE_URL}/products/toggle-promo/${id}`, { usePromoPrice: !currentValue }, { headers: getAuthHeaders() });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, usePromoPrice: !currentValue } : p)));
    } catch (error) {
      console.error('Error toggling promo price:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to toggle promo price', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, []);

  const handleBulkTogglePromo = useCallback(async (usePromoPrice) => {
    try {
      const carrier = searchQuery.trim() || null;
      await axios.patch(`${BASE_URL}/products/bulk-toggle-promo`, { usePromoPrice, carrier }, { headers: getAuthHeaders() });
      setProducts((prev) => {
        if (carrier) {
          return prev.map((p) => (p.name?.toLowerCase().includes(carrier.toLowerCase()) ? { ...p, usePromoPrice } : p));
        }
        return prev.map((p) => ({ ...p, usePromoPrice }));
      });
      Swal.fire({
        title: usePromoPrice ? 'Promo Prices Active' : 'Main Prices Active',
        text: usePromoPrice
          ? `Products ${carrier ? `matching "${carrier}"` : ''} switched to promo prices`
          : `Products ${carrier ? `matching "${carrier}"` : ''} switched to main prices`,
        icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false
      });
    } catch (error) {
      console.error('Error bulk toggling promo prices:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to switch prices', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, [searchQuery]);

  const handleBulkAgentVisibility = useCallback(async (showForAgents) => {
    try {
      const carrier = searchQuery.trim() || null;
      await axios.patch(`${BASE_URL}/products/bulk-agent-visibility`, { showForAgents, carrier }, { headers: getAuthHeaders() });
      setProducts((prev) => {
        if (carrier) {
          return prev.map((p) => (p.name?.toLowerCase().includes(carrier.toLowerCase()) ? { ...p, showForAgents } : p));
        }
        return prev.map((p) => ({ ...p, showForAgents }));
      });
      Swal.fire({
        title: showForAgents ? 'Agents Enabled' : 'Agents Disabled',
        text: showForAgents
          ? `Products ${carrier ? `matching "${carrier}"` : ''} now visible to agents`
          : `Products ${carrier ? `matching "${carrier}"` : ''} hidden from agents`,
        icon: 'success', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false
      });
    } catch (error) {
      console.error('Error bulk updating agent visibility:', error);
      Swal.fire({ title: 'Error!', text: 'Failed to update agent visibility', icon: 'error', background: '#1e293b', color: '#f1f5f9' });
    }
  }, [searchQuery]);

  const handleEditClick = useCallback((product) => {
    setEditingProduct(product);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingProduct(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/50 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Product Management</h2>
                <p className="text-slate-400 text-xs mt-0.5">{products.length} total &middot; {filteredProducts.length} shown</p>
              </div>
            </div>
            <button onClick={() => { setEditingProduct(null); onClose(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/50 transition-colors group">
              <X className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Add/Edit Form - isolated sub-component, local state, won't re-render the table below on keystroke */}
          <ProductForm
            editingProduct={editingProduct}
            onSave={handleSaveProduct}
            onCancel={handleCancelEdit}
            isSaving={isSaving}
          />

          {/* Search & Bulk Controls */}
          <div className="space-y-3">
            <SearchInput onSearchChange={setSearchQuery} />
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Carrier Stock */}
              <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">Stock</span>
                {['MTN', 'TELECEL', 'AIRTEL TIGO'].map((carrier) => (
                  <div key={carrier} className="flex items-center gap-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${carrier === 'MTN' ? 'bg-yellow-400' : carrier === 'TELECEL' ? 'bg-red-400' : 'bg-blue-400'}`}></span>
                    <button onClick={() => handleBulkSetStock(carrier, 1)} className="px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/15 rounded transition-colors">1</button>
                    <button onClick={() => handleBulkSetStock(carrier, 0)} className="px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/15 rounded transition-colors">0</button>
                  </div>
                ))}
              </div>
              {/* Shop Stock */}
              <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">Shop</span>
                <button onClick={() => handleBulkShopStock(false)} className="px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/15 rounded transition-colors">Open</button>
                <button onClick={() => handleBulkShopStock(true)} className="px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/15 rounded transition-colors">Close</button>
              </div>
              {/* Agents */}
              <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">Agents</span>
                <button onClick={() => handleBulkAgentVisibility(true)} className="px-2 py-0.5 text-[10px] font-medium text-purple-400 hover:bg-purple-500/15 rounded transition-colors">Show</button>
                <button onClick={() => handleBulkAgentVisibility(false)} className="px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/15 rounded transition-colors">Hide</button>
              </div>
              {/* Pricing */}
              <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">Price</span>
                <button onClick={() => handleBulkTogglePromo(true)} className="px-2 py-0.5 text-[10px] font-medium text-orange-400 hover:bg-orange-500/15 rounded transition-colors">Promo</button>
                <button onClick={() => handleBulkTogglePromo(false)} className="px-2 py-0.5 text-[10px] font-medium text-cyan-400 hover:bg-cyan-500/15 rounded transition-colors">Main</button>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="rounded-xl border border-slate-700/30 overflow-hidden bg-slate-900/30">
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">ID</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Product</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Description</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Price</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-orange-400/60 uppercase tracking-widest">Promo</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Use Promo</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Stock</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Shop</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Shop Stock</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Agent</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {isLoading ? (
                    <tr><td colSpan="11" className="px-4 py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500" />
                      <p className="text-slate-500 text-xs mt-2">Loading products...</p>
                    </td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan="11" className="px-4 py-12 text-center">
                      <Package className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                      <p className="text-slate-500 text-xs">No products found</p>
                    </td></tr>
                  ) : (
                    filteredProducts.map((product, idx) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        idx={idx}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteProduct}
                        onToggleShop={handleToggleShop}
                        onToggleShopStock={handleToggleShopStock}
                        onSetStock={handleSetStock}
                        onToggleAgent={handleToggleAgent}
                        onTogglePromo={handleTogglePromo}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDialog;
