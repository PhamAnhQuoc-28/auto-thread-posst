import React, { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useJsApiLoader, GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api';

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  address: string;
  product: string;
  total_amount: number;
  deposit: number;
  shipping_fee: number;
  cod: number;
  shipping_unit: string;
  platform: string;
  status: string;
  notes: string;
  delivery_date: string | null;
}

const defaultForm = {
  customer_name: '', phone: '', address: '', product: '', 
  total_amount: 0, deposit: 0, shipping_fee: 0, cod: 0,
  shipping_unit: 'SPX', platform: 'Threads',
  status: 'pending', notes: '', delivery_date: ''
};

export default function OrdersApp() {
  const activeUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const activeKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form states
  const [form, setForm] = useState(defaultForm);

  // Map states
  const [showMap, setShowMap] = useState(false);
  const [mapApiKey, setMapApiKey] = useState(() => localStorage.getItem('orders_gmaps_api_key') || '');
  const [homeAddress, setHomeAddress] = useState(() => localStorage.getItem('orders_home_address') || 'Hà Nội');
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [optimizedOrders, setOptimizedOrders] = useState<any[]>([]);
  const [mapStatus, setMapStatus] = useState('');
  const [isMapLoading, setIsMapLoading] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: mapApiKey,
  });

  // Reset trang về 1 khi đổi bộ lọc hoặc đổi số lượng hiển thị
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterPlatform, filterDate, showDeleted, itemsPerPage]);

  useEffect(() => {
    if (activeUrl && activeKey) {
      try {
        const client = createClient(activeUrl, activeKey);
        setSupabase(client);
      } catch (err) {
        alert("Thông tin Supabase trong file .env không hợp lệ!");
        setSupabase(null);
      }
    } else {
      setSupabase(null);
    }
  }, [activeUrl, activeKey]);

  useEffect(() => {
    if (supabase) {
      fetchOrders();
    }
  }, [supabase]);

  // Tự động tính COD khi tiền hàng, cọc, phí ship thay đổi
  useEffect(() => {
    const calcCod = Math.max(0, form.total_amount - form.deposit + form.shipping_fee);
    setForm(prev => ({ ...prev, cod: calcCod }));
  }, [form.total_amount, form.deposit, form.shipping_fee]);

  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    // Lấy TẤT CẢ đơn hàng để dễ bề phân loại Thùng rác / Đang active
    const { data, error } = await supabase.from('orders')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      alert("Lỗi tải đơn hàng: " + error.message);
    } else {
      setOrders(data as any[]);
    }
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowForm(true);
  };

  const handleOpenEdit = (order: any) => {
    setForm({
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      address: order.address || '',
      product: order.product || '',
      total_amount: order.total_amount || 0,
      deposit: order.deposit || 0,
      shipping_fee: order.shipping_fee || 0,
      cod: order.cod || 0,
      shipping_unit: order.shipping_unit || 'SPX',
      platform: order.platform || 'Threads',
      status: order.status || 'pending',
      notes: order.notes || '',
      delivery_date: order.delivery_date || ''
    });
    setEditId(order.id);
    setShowForm(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setLoading(true);
    // Xử lý ngày rỗng
    const submitData = { ...form };
    if (!submitData.delivery_date) {
      delete (submitData as any).delivery_date;
    }

    if (editId) {
      const { error } = await supabase.from('orders').update(submitData).eq('id', editId);
      if (error) alert("Lỗi cập nhật đơn hàng: " + error.message);
      else finishSave();
    } else {
      const { error } = await supabase.from('orders').insert([submitData]);
      if (error) alert("Lỗi lưu đơn mới: " + error.message);
      else finishSave();
    }
  };

  const finishSave = () => {
    setLoading(false);
    setShowForm(false);
    setForm(defaultForm);
    setEditId(null);
    fetchOrders();
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    setLoading(false);
    
    if (error) {
      alert("Lỗi cập nhật trạng thái: " + error.message);
    } else {
      fetchOrders();
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    if (window.confirm('Bạn có chắc chắn muốn XÓA đơn hàng này?\n(Đây là xóa mềm, có thể khôi phục trong Thùng Rác)')) {
      setLoading(true);
      const { error } = await supabase.from('orders').update({ is_deleted: true }).eq('id', id);
      setLoading(false);
      
      if (error) {
        alert("Lỗi xóa đơn hàng: " + error.message);
      } else {
        fetchOrders();
      }
    }
  };

  const handleRestore = async (id: string) => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from('orders').update({ is_deleted: false }).eq('id', id);
    setLoading(false);
    if (error) {
      alert("Lỗi khôi phục đơn hàng: " + error.message);
    } else {
      fetchOrders();
    }
  };

  function removeAccents(str: string) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  }

  const filteredOrders = orders.filter((order: any) => {
    // Nếu đang xem Thùng rác, chỉ hiện đơn bị xóa. Ngược lại chỉ hiện đơn chưa bị xóa.
    if (showDeleted) {
      if (order.is_deleted !== true) return false;
    } else {
      if (order.is_deleted === true) return false;
    }

    const normalizedQuery = removeAccents(searchQuery);
    const searchWords = normalizedQuery.split(' ').filter(Boolean);
    
    const searchTarget = removeAccents(
      `${order.customer_name} ${order.phone || ''} ${order.address || ''} ${order.product || ''} ${order.notes || ''}`
    );
    
    const matchesSearch = searchWords.length === 0 || searchWords.every(word => searchTarget.includes(word));
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesPlatform = filterPlatform === 'all' || order.platform === filterPlatform;
    const matchesDate = !filterDate || order.delivery_date === filterDate;
    
    return matchesSearch && matchesStatus && matchesPlatform && matchesDate;
  });

  const handleOptimizeRoute = () => {
    if (!mapApiKey) {
      alert('Vui lòng nhập Google Maps API Key trước!');
      return;
    }
    
    const ordersToRoute = filteredOrders.filter((o: any) => !o.is_deleted && o.status === 'pending' && o.address && o.address.trim() !== '');
    if (ordersToRoute.length === 0) {
      alert('Không có đơn hàng nào chờ giao có địa chỉ hợp lệ trong danh sách (theo bộ lọc hiện tại)!');
      return;
    }
    if (ordersToRoute.length > 24) {
      alert(`Google Maps chỉ hỗ trợ tối đa 25 điểm (bao gồm 1 điểm xuất phát). Bạn đang có ${ordersToRoute.length} đơn. Vui lòng lọc bớt.`);
      return;
    }

    setIsMapLoading(true);
    setMapStatus('Đang tìm đường đi tối ưu...');
    setDirectionsResult(null);
    setOptimizedOrders([]);

    const directionsService = new window.google.maps.DirectionsService();
    const origin = homeAddress;
    const waypoints = ordersToRoute.map((o: any) => ({ location: o.address, stopover: true }));

    directionsService.route({
      origin: origin,
      destination: origin, // Về lại nhà
      waypoints: waypoints,
      optimizeWaypoints: true,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      setIsMapLoading(false);
      if (status === window.google.maps.DirectionsStatus.OK && result) {
        setDirectionsResult(result);
        const order = result.routes[0].waypoint_order;
        const legs = result.routes[0].legs;
        
        const ordered = [{
          id: 'home',
          customer_name: 'Nhà / Điểm Xuất Phát',
          address: origin,
          product: '',
          lat: legs[0].start_location.lat(),
          lon: legs[0].start_location.lng()
        }];
        
        order.forEach((index: number, i: number) => {
          ordered.push({
            ...ordersToRoute[index],
            lat: legs[i].end_location.lat(),
            lon: legs[i].end_location.lng()
          });
        });
        
        setOptimizedOrders(ordered);
        setMapStatus('Hoàn tất tối ưu!');
      } else {
        setMapStatus('');
        alert(`Lỗi từ Google Maps: ${status}. Vui lòng kiểm tra địa chỉ hoặc API Key.`);
      }
    });
  };

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="orders-container">
      <div className="header-glass">
        <h1>📦 Quản lý Đơn Hàng</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Ghi nhận và tracking đơn hàng qua Supabase</p>
        
        {!activeUrl || !activeKey ? (
          <div style={{ padding: '2rem', color: '#b91c1c', background: '#fee2e2', borderRadius: '8px' }}>
            <strong>Chưa cấu hình Supabase!</strong><br />
            Hãy tạo file <code>.env</code> ở thư mục gốc và thêm <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code>, sau đó chạy lại lệnh build.
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button className="btn-primary" onClick={handleOpenAdd}>➕ Thêm Đơn Mới</button>
            <button className="btn-secondary" onClick={fetchOrders} disabled={loading}>
              {loading ? 'Đang tải...' : '🔄 Làm Mới'}
            </button>
            <button className="btn-primary" style={{background: '#10b981', borderColor: '#10b981'}} onClick={() => setShowMap(true)}>
              🗺️ Lộ Trình Giao
            </button>
            <button 
              className={`btn-secondary ${showDeleted ? 'active-trash' : ''}`} 
              onClick={() => setShowDeleted(!showDeleted)}
              title={showDeleted ? 'Quay lại danh sách' : 'Xem Thùng rác'}
            >
              {showDeleted ? '🔙 Quay lại' : '🗑️ Thùng Rác'}
            </button>
          </div>
        )}
      </div>

      {activeUrl && activeKey && (
        <div className="content-grid">
          
          <div className="filters-container">
            <input 
              type="text" 
              placeholder="🔍 Tìm tên khách, SĐT, sản phẩm..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field flex-2"
            />
            <input 
              type="date" 
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="input-field flex-1"
              title="Lọc theo ngày giao dự kiến"
            />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field flex-1">
              <option value="all">Tất cả Trạng Thái</option>
              <option value="pending">Chờ Giao</option>
              <option value="delivering">Đang Giao</option>
              <option value="completed">Hoàn Thành</option>
              <option value="cancelled">Đã Hủy</option>
            </select>
            <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="input-field flex-1">
              <option value="all">Tất cả Nguồn</option>
              <option value="Threads">Threads</option>
              <option value="FB">Facebook</option>
              <option value="IG">Instagram</option>
              <option value="Tiktok">Tiktok</option>
              <option value="Khác">Khác</option>
            </select>
            {filterDate && (
              <button 
                className="btn-secondary" 
                style={{padding: '0.5rem', borderRadius: '8px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold'}} 
                onClick={() => setFilterDate('')}
                title="Xóa bộ lọc ngày"
              >
                ✕ Hủy ngày
              </button>
            )}
          </div>

          {showForm && (
            <div className="modal-overlay">
              <div className="modal-content large-modal">
                <h2>{editId ? 'Sửa Đơn Hàng' : 'Tạo Đơn Hàng Mới'}</h2>
                <form onSubmit={handleSaveOrder} className="order-form">
                  <div className="form-row">
                    <div className="form-group flex-2">
                      <label>Tên Khách Hàng (*)</label>
                      <input required type="text" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} />
                    </div>
                    <div className="form-group flex-1">
                      <label>Số Điện Thoại</label>
                      <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                    </div>
                    <div className="form-group flex-1">
                      <label>Nguồn Khách</label>
                      <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                        <option value="Threads">Threads</option>
                        <option value="FB">Facebook</option>
                        <option value="IG">Instagram</option>
                        <option value="Tiktok">Tiktok</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Địa Chỉ Giao Hàng</label>
                    <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="VD: 137 Đặng Thái Thân, P. Thanh Vinh, Nghệ An" />
                  </div>

                  <div className="form-group">
                    <label>Danh sách Sản Phẩm (*)</label>
                    <textarea required rows={3} value={form.product} onChange={e => setForm({...form, product: e.target.value})} placeholder="VD: 1 lạc giòn 50k&#10;1 cheese 8cm 85k&#10;1 măng cụt vsl 50k" />
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Tiền Hàng (VNĐ)</label>
                      <input type="number" value={form.total_amount || ''} onChange={e => setForm({...form, total_amount: Number(e.target.value)})} />
                    </div>
                    <div className="form-group flex-1">
                      <label>Đã Cọc (VNĐ)</label>
                      <input type="number" value={form.deposit || ''} onChange={e => setForm({...form, deposit: Number(e.target.value)})} />
                    </div>
                    <div className="form-group flex-1">
                      <label>ĐVVC / Lấy hàng</label>
                      <select value={form.shipping_unit} onChange={e => setForm({...form, shipping_unit: e.target.value})}>
                        <option value="SPX">SPX</option>
                        <option value="GHTK">GHTK</option>
                        <option value="GHN">GHN</option>
                        <option value="Viettel">Viettel Post</option>
                        <option value="Tự Lấy">Lấy trực tiếp</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Phí Ship (VNĐ)</label>
                      <input type="number" value={form.shipping_fee || ''} onChange={e => setForm({...form, shipping_fee: Number(e.target.value)})} />
                    </div>
                    <div className="form-group flex-1 highlight-cod">
                      <label>Cần Thu Hộ (COD)</label>
                      <input type="number" value={form.cod || ''} onChange={e => setForm({...form, cod: Number(e.target.value)})} />
                    </div>
                    <div className="form-group flex-1">
                      <label>Ngày Giao (Dự Kiến)</label>
                      <input type="date" value={form.delivery_date} onChange={e => setForm({...form, delivery_date: e.target.value})} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Ghi Chú</label>
                    <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Mai ghé công ty lấy tầm 10h, gửi c.Như..." />
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Hủy</button>
                    <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu Đơn'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showMap && (
            <div className="modal-overlay" style={{zIndex: 2000}}>
              <div className="modal-content" style={{maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                  <h2>🗺️ Bản Đồ & Lộ Trình Giao Hàng</h2>
                  <button onClick={() => setShowMap(false)} className="btn-secondary">Đóng</button>
                </div>

                <div className="form-row" style={{marginBottom: '1rem', background: '#f9fafb', padding: '1rem', borderRadius: '8px'}}>
                  <div className="form-group flex-1">
                    <label>Google Maps API Key</label>
                    <input type="password" value={mapApiKey} onChange={e => {
                      setMapApiKey(e.target.value);
                      localStorage.setItem('orders_gmaps_api_key', e.target.value);
                    }} placeholder="Nhập API Key..." />
                  </div>
                  <div className="form-group flex-1">
                    <label>Địa chỉ xuất phát (Kho/Nhà)</label>
                    <input type="text" value={homeAddress} onChange={e => {
                      setHomeAddress(e.target.value);
                      localStorage.setItem('orders_home_address', e.target.value);
                    }} placeholder="VD: 123 Cầu Giấy, Hà Nội" />
                  </div>
                  <div className="form-group" style={{display: 'flex', alignItems: 'flex-end'}}>
                    <button className="btn-primary" style={{background: '#10b981', borderColor: '#10b981'}} onClick={handleOptimizeRoute} disabled={isMapLoading || !isLoaded}>
                      {isMapLoading ? 'Đang tính toán...' : '📍 Bắt đầu tối ưu'}
                    </button>
                  </div>
                </div>

                {mapStatus && <div style={{textAlign: 'center', marginBottom: '1rem', fontWeight: 'bold', color: '#059669'}}>{mapStatus}</div>}
                
                <div className="content-grid" style={{flex: 1, minHeight: 0}}>
                  <div className="route-list-container">
                    <h3 style={{marginTop: 0, paddingBottom: '10px', borderBottom: '1px solid #eee'}}>📋 Thứ tự giao hàng</h3>
                    {optimizedOrders.length === 0 ? (
                      <p style={{color: '#6b7280', marginTop: '1rem'}}>Bấm "Bắt đầu tối ưu" để hệ thống tính toán lộ trình từ các đơn "Chờ Giao" đang hiển thị trên bảng.</p>
                    ) : (
                      <div style={{overflowY: 'auto', maxHeight: 'calc(100% - 30px)', paddingRight: '10px'}}>
                        {optimizedOrders.map((o, idx) => (
                          <div className="route-item" key={o.id} style={{borderLeftColor: idx === 0 ? '#10b981' : '#3b82f6'}}>
                            <div className="route-number" style={{background: idx === 0 ? '#10b981' : '#3b82f6'}}>{idx === 0 ? '🏠' : idx}</div>
                            <div className="route-details">
                              <h4 style={{margin: '0 0 4px 0'}}>{o.customer_name} {idx === 0 && '(Điểm xuất phát)'}</h4>
                              <p style={{margin: '0 0 4px 0', fontSize: '0.9rem'}}>{o.address}</p>
                              {o.product && <span className="product-tag">📦 {o.product}</span>}
                              {o.phone && <div style={{marginTop: '6px', fontSize: '0.85rem', color: '#059669'}}>📞 {o.phone}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="map-container">
                    {isLoaded && mapApiKey ? (
                      <GoogleMap
                        mapContainerStyle={{width: '100%', height: '100%', borderRadius: '8px'}}
                        center={{lat: 21.0285, lng: 105.8542}}
                        zoom={12}
                        options={{ disableDefaultUI: true, zoomControl: true }}
                      >
                        {directionsResult && <DirectionsRenderer directions={directionsResult} options={{ suppressMarkers: true }} />}
                        {optimizedOrders.map((o, idx) => (
                          <Marker 
                            key={o.id} 
                            position={{ lat: o.lat, lng: o.lon }} 
                            label={{ text: idx === 0 ? 'H' : idx.toString(), color: 'white', fontWeight: 'bold' }}
                          />
                        ))}
                      </GoogleMap>
                    ) : (
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f3f4f6', borderRadius: '8px', color: '#9ca3af', textAlign: 'center', padding: '2rem'}}>
                        {!mapApiKey ? 'Vui lòng nhập API Key để xem bản đồ' : 'Đang tải bản đồ...'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="orders-list">
            {showDeleted && <div style={{background: '#fef2f2', color: '#b91c1c', padding: '1rem', textAlign: 'center', fontWeight: 'bold'}}>🗑️ Đang hiển thị các đơn hàng trong Thùng Rác</div>}
            {filteredOrders.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
                {showDeleted ? 'Thùng rác trống.' : 'Không tìm thấy đơn hàng nào phù hợp!'}
              </div>
            )}
            
            {filteredOrders.length > 0 && (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Khách & Nguồn</th>
                    <th>Địa Chỉ & SĐT</th>
                    <th>Sản Phẩm</th>
                    <th>Tài Chính</th>
                    <th>Giao Hàng</th>
                    <th>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order: any) => (
                    <tr key={order.id} style={{ opacity: order.is_deleted ? 0.7 : 1 }}>
                      <td>
                        <strong>{order.customer_name}</strong>
                        <div className="tag-platform">{order.platform}</div>
                        <div className="order-date">{new Date(order.created_at).toLocaleDateString('vi-VN')}</div>
                      </td>
                      <td>
                        <div style={{fontWeight: 500, color: '#374151'}}>{order.phone}</div>
                        <div style={{fontSize: '0.85rem', color: '#6B7280', maxWidth: '200px'}}>{order.address}</div>
                      </td>
                      <td>
                        <div style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem', maxWidth: '250px'}}>{order.product}</div>
                        {order.notes && <div className="order-notes">📝 {order.notes}</div>}
                      </td>
                      <td>
                        <div className="finance-row"><span>Tiền hàng:</span> <strong>{order.total_amount?.toLocaleString('vi-VN')}đ</strong></div>
                        <div className="finance-row" style={{color: '#059669'}}><span>Đã cọc:</span> <strong>{order.deposit?.toLocaleString('vi-VN')}đ</strong></div>
                        <div className="finance-row"><span>Ship:</span> <strong>{order.shipping_fee?.toLocaleString('vi-VN')}đ</strong></div>
                        <div className="finance-row highlight"><span>Cần thu (COD):</span> <strong>{order.cod?.toLocaleString('vi-VN')}đ</strong></div>
                      </td>
                      <td>
                        <div className="tag-shipping">{order.shipping_unit}</div>
                        {order.delivery_date && (
                          <div style={{fontSize: '0.85rem', color: '#059669', marginTop: '6px', fontWeight: 500}}>
                            📅 Giao: {new Date(order.delivery_date).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td style={{minWidth: '120px'}}>
                        <select 
                          value={order.status} 
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`status-select status-${order.status}`}
                          disabled={order.is_deleted}
                        >
                          <option value="pending">Chờ Giao</option>
                          <option value="delivering">Đang Giao</option>
                          <option value="completed">Hoàn Thành</option>
                          <option value="cancelled">Đã Hủy</option>
                        </select>
                        <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                          {order.is_deleted ? (
                            <button onClick={() => handleRestore(order.id)} className="btn-action restore" title="Khôi phục">♻️ Khôi phục</button>
                          ) : (
                            <>
                              <button onClick={() => handleOpenEdit(order)} className="btn-action edit" title="Sửa đơn">✏️ Sửa</button>
                              <button onClick={() => handleDelete(order.id)} className="btn-action delete" title="Xóa đơn">🗑️ Xóa</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {filteredOrders.length > 0 && (
              <div className="pagination" style={{ flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
                  <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>Hiển thị:</label>
                  <select 
                    value={itemsPerPage} 
                    onChange={e => setItemsPerPage(Number(e.target.value))}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', cursor: 'pointer', fontWeight: 500, color: '#374151' }}
                  >
                    <option value={10}>10 đơn / trang</option>
                    <option value={20}>20 đơn / trang</option>
                    <option value={50}>50 đơn / trang</option>
                    <option value={100}>100 đơn / trang</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="btn-page"
                  >
                    &lt; Trước
                  </button>
                  <span className="page-info">Trang {currentPage} / {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="btn-page"
                  >
                    Sau &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
