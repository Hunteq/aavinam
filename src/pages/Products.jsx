import React, { useState, useEffect } from 'react';
import { useBranch } from '../context/BranchContext';
import { db } from '../db/db';
import { Package, Plus, Edit2, Trash2, IndianRupee, Save, X, ShieldAlert } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

const Products = () => {
    const { currentBranch } = useBranch();
    const { isFarmer, isOwner, isMember } = useUser();
    const { t } = useLanguage();
    const [products, setProducts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        unit: 'L',
        category: 'Milk Products'
    });

    const predefinedProducts = [
        { name: 'Badam Milk', unit: 'L', category: 'Milk Products' },
        { name: 'Rose Milk', unit: 'L', category: 'Milk Products' },
        { name: 'Pista Milk', unit: 'L', category: 'Milk Products' },
        { name: 'Curd', unit: 'kg', category: 'Dairy Products' },
        { name: 'Buttermilk', unit: 'L', category: 'Dairy Products' },
        { name: 'Ghee', unit: 'kg', category: 'Dairy Products' },
        { name: 'Paneer', unit: 'kg', category: 'Dairy Products' }
    ];

    useEffect(() => {
        if (currentBranch) {
            loadProducts();
        }
    }, [currentBranch]);

    const loadProducts = async () => {
        const productsList = await db.products
            .where('branchId').equals(currentBranch.id)
            .toArray();
        setProducts(productsList);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (editingProduct) {
            await db.products.update(editingProduct.id, {
                name: formData.name,
                price: parseFloat(formData.price),
                unit: formData.unit,
                category: formData.category,
                updatedAt: new Date()
            });
        } else {
            await db.products.add({
                branchId: currentBranch.id,
                name: formData.name,
                price: parseFloat(formData.price),
                unit: formData.unit,
                category: formData.category,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        setFormData({ name: '', price: '', unit: 'L', category: 'Milk Products' });
        setShowForm(false);
        setEditingProduct(null);
        loadProducts();
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            price: product.price.toString(),
            unit: product.unit,
            category: product.category
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (confirm(t('products.deleteConfirm'))) {
            await db.products.delete(id);
            loadProducts();
        }
    };

    const addPredefinedProduct = (product) => {
        setFormData({
            name: product.name,
            price: '',
            unit: product.unit,
            category: product.category
        });
        setShowForm(true);
    };



    const groupedProducts = products.reduce((acc, product) => {
        if (!acc[product.category]) acc[product.category] = [];
        acc[product.category].push(product);
        return acc;
    }, {});

    const getCategoryLabel = (cat) => {
        if (cat === 'Milk Products') return t('products.milkProducts');
        if (cat === 'Dairy Products') return t('products.dairyProducts');
        if (cat === 'Custom') return t('products.custom');
        return cat;
    };

    return (
        <div className="products-page">
            <div className="page-header">
                <div>
                    <h1>{t('products.title')}</h1>
                    <p>{t('products.subtitle')}</p>
                </div>
                {!isFarmer && (
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={18} /> {t('products.addProduct')}
                    </button>
                )}
            </div>

            {isFarmer && (
                <div className="info-banner" style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px' }}>
                    <ShieldAlert size={20} />
                    <span>{t('products.farmerNoProducts')}</span>
                </div>
            )}

            {showForm && (
                <div className="card product-form">
                    <div className="form-header">
                        <h3>{editingProduct ? t('products.editProduct') : t('products.addNewProduct')}</h3>
                        <button className="btn-icon" onClick={() => {
                            setShowForm(false);
                            setEditingProduct(null);
                            setFormData({ name: '', price: '', unit: 'L', category: 'Milk Products' });
                        }}>
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>{t('products.productName')}</label>
                                <input
                                    type="text"
                                    className="rural-input"
                                    placeholder="e.g. Badam Milk"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('products.price')}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="rural-input"
                                    placeholder="e.g. 50"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>{t('products.unit')}</label>
                                <select
                                    className="rural-input"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    <option value="L">Liter (L)</option>
                                    <option value="kg">Kilogram (kg)</option>
                                    <option value="pcs">Pieces (pcs)</option>
                                    <option value="pack">Pack</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('products.category')}</label>
                                <select
                                    className="rural-input"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="Milk Products">{t('products.milkProducts')}</option>
                                    <option value="Dairy Products">{t('products.dairyProducts')}</option>
                                    <option value="Custom">{t('products.custom')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                <Save size={18} /> {editingProduct ? t('common.update') : t('common.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && products.length === 0 && (
                <div className="card empty-products">
                    <Package size={48} color="#94a3b8" />
                    <h3>{t('products.noProducts')}</h3>
                    <p>{isFarmer ? t('products.farmerNoProducts') : t('products.adminNoProducts')}</p>
                    {!isFarmer && (
                        <div className="predefined-grid">
                            {predefinedProducts.map((product, idx) => (
                                <button
                                    key={idx}
                                    className="predefined-btn"
                                    onClick={() => addPredefinedProduct(product)}
                                >
                                    <Plus size={16} /> {product.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {products.length > 0 && (
                <div className="products-grid">
                    {Object.entries(groupedProducts).map(([category, items]) => (
                        <div key={category} className="category-section">
                            <h3 className="category-title">{getCategoryLabel(category)}</h3>
                            <div className="product-cards">
                                {items.map(product => (
                                    <div key={product.id} className="card product-card">
                                        <div className="product-info">
                                            <h4>{product.name}</h4>
                                            <div className="product-price">
                                                <IndianRupee size={18} />
                                                <span className="price">{product.price}</span>
                                                <span className="unit">/ {product.unit}</span>
                                            </div>
                                        </div>
                                        {!isFarmer && (
                                            <div className="product-actions">
                                                <button
                                                    className="btn-icon edit"
                                                    onClick={() => handleEdit(product)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon delete"
                                                    onClick={() => handleDelete(product.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .products-page { display: flex; flex-direction: column; gap: 24px; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .header-actions { display: flex; gap: 12px; }

                .product-form { max-width: 700px; }
                .form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .form-actions { margin-top: 20px; }

                .empty-products { text-align: center; padding: 40px; }
                .empty-products h3 { margin: 16px 0 8px; color: var(--secondary); }
                .empty-products p { color: #64748b; margin-bottom: 24px; }

                .predefined-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; max-width: 600px; margin: 0 auto; }
                .predefined-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; cursor: pointer; font-weight: 700; color: var(--secondary); transition: 0.2s; }
                .predefined-btn:hover { background: #e2e8f0; border-color: var(--primary); color: var(--primary); }

                .products-grid { display: flex; flex-direction: column; gap: 32px; }
                .category-section { }
                .category-title { font-size: 1.2rem; margin-bottom: 16px; color: var(--secondary); border-bottom: 2px solid var(--border); padding-bottom: 8px; }

                .product-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .product-card { display: flex; justify-content: space-between; align-items: center; padding: 20px; transition: 0.2s; }
                .product-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }

                .product-info h4 { font-size: 1.1rem; margin-bottom: 8px; color: var(--secondary); }
                .product-price { display: flex; align-items: center; gap: 4px; color: var(--primary); }
                .product-price .price { font-size: 1.5rem; font-weight: 800; }
                .product-price .unit { font-size: 0.85rem; color: #64748b; }

                .product-actions { display: flex; gap: 8px; }
                .btn-icon { padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: white; cursor: pointer; transition: 0.2s; }
                .btn-icon:hover { background: #f8fafc; }
                .btn-icon.edit:hover { background: #eff6ff; color: #2563eb; border-color: #2563eb; }
                .btn-icon.delete:hover { background: #fef2f2; color: #dc2626; border-color: #dc2626; }

                @media (max-width: 768px) {
                    .products-page { gap: 16px; }
                    .page-header { flex-direction: column; gap: 16px; }
                    .header-actions { width: 100%; flex-direction: column; }
                    .header-actions button { flex: 1; width: 100%; }
                    .product-cards { grid-template-columns: 1fr; gap: 12px; }
                    .product-card { padding: 16px; }
                    .predefined-grid { grid-template-columns: 1fr; }
                    .product-form { padding: 16px; }
                }
                `
            }} />
        </div>
    );
};

export default Products;
