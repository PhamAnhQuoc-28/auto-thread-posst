import React, { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useJsApiLoader, GoogleMap, DirectionsRenderer, Marker, Autocomplete } from '@react-google-maps/api';

const libraries: ("places")[] = ['places'];

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
  
  // Selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Form states
  const [form, setForm] = useState(defaultForm);

  // Map states
  const [showMap, setShowMap] = useState(false);
  const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || localStorage.getItem('orders_gmaps_api_key') || '';
  const [homeAddress, setHomeAddress] = useState(() => localStorage.getItem('orders_home_address') || 'Hà Nội');
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [optimizedOrders, setOptimizedOrders] = useState<any[]>([]);
  const [mapUrl, setMapUrl] = useState<string>('');
  const [mapStatus, setMapStatus] = useState('');
  const [isMapLoading, setIsMapLoading] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: mapApiKey,
    libraries
  });

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const onLoadAutocomplete = (ac: google.maps.places.Autocomplete) => {
    setAutocomplete(ac);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place && place.formatted_address) {
        setForm(f => ({ ...f, address: place.formatted_address! }));
      }
    }
  };

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

  // Tạo link Google Maps tự động khi lộ trình thay đổi
  useEffect(() => {
    if (optimizedOrders.length >= 2) {
      // Sử dụng định dạng URL dạng đường dẫn (dir/lat,lon/lat,lon)
      // Dùng tọa độ GPS TUYỆT ĐỐI (lat,lon) thay vì dùng chuỗi địa chỉ để tránh lỗi các ký tự đặc biệt
      // Thêm data=!4m2!4m1!3e9 để gợi ý mở bằng chế độ Xe máy (nếu app hỗ trợ)
      const places = optimizedOrders.map(o => `${o.lat},${o.lon}`).join('/');
      const url = `https://www.google.com/maps/dir/${places}/data=!4m2!4m1!3e9`;
      setMapUrl(url);
    } else {
      setMapUrl('');
    }
  }, [optimizedOrders]);

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
    
    if (!homeAddress || homeAddress.trim() === '') {
      alert('Vui lòng nhập "Địa chỉ xuất phát" (hoặc dùng nút 📍 để lấy vị trí hiện tại) trước khi tối ưu lộ trình!');
      return;
    }
    
    // Lấy các đơn hàng đã được tick chọn
    const ordersToRoute = orders.filter((o: any) => selectedOrderIds.includes(o.id) && o.address && o.address.trim() !== '');
    
    if (ordersToRoute.length === 0) {
      alert('Bạn chưa chọn đơn hàng nào (hoặc các đơn đã chọn không có địa chỉ hợp lệ)! Vui lòng tick chọn các đơn hàng trên bảng trước.');
      return;
    }
    if (ordersToRoute.length > 24) {
      alert(`Google Maps chỉ hỗ trợ tối đa 25 điểm (bao gồm 1 điểm xuất phát). Bạn đang chọn ${ordersToRoute.length} đơn. Vui lòng bỏ tick bớt.`);
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
      travelMode: 'TWO_WHEELER' as google.maps.TravelMode,
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ lấy vị trí (GPS).');
      return;
    }
    
    setIsMapLoading(true);
    setMapStatus('Đang lấy vị trí hiện tại...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Dùng Geocoder của Google Maps để dịch tọa độ sang địa chỉ
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setIsMapLoading(false);
          if (status === 'OK' && results && results[0]) {
            const address = results[0].formatted_address;
            setHomeAddress(address);
            localStorage.setItem('orders_home_address', address);
            setMapStatus('Đã lấy được vị trí hiện tại!');
            setTimeout(() => setMapStatus(''), 3000);
          } else {
            // Nếu không dịch được, dùng luôn tọa độ làm string
            const coordStr = `${lat}, ${lng}`;
            setHomeAddress(coordStr);
            localStorage.setItem('orders_home_address', coordStr);
            setMapStatus('Đã lấy tọa độ (không dịch được tên đường).');
            setTimeout(() => setMapStatus(''), 3000);
          }
        });
      },
      (error) => {
        setIsMapLoading(false);
        setMapStatus('');
        // Phân tích mã lỗi rõ ràng hơn
        let errorStr = '';
        if (error.code === error.PERMISSION_DENIED) errorStr = 'Trình duyệt hoặc HĐH từ chối quyền (hoặc không lấy được tín hiệu GPS).';
        else if (error.code === error.POSITION_UNAVAILABLE) errorStr = 'Không thể xác định vị trí hiện tại.';
        else if (error.code === error.TIMEOUT) errorStr = 'Quá thời gian lấy vị trí.';
        else errorStr = error.message;
        
        alert(`Lỗi lấy vị trí: ${errorStr}\n\n(Vì bạn đang dùng Máy tính, bạn có thể tự nhập tay địa chỉ kho hàng vào ô "Địa chỉ xuất phát" để dùng luôn nhé!)`);
      },
      // Tắt enableHighAccuracy để PC có thể dùng vị trí dựa trên mạng (IP) thay vì ép dùng phần cứng GPS
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  };

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const paginatedIds = paginatedOrders.map((o: any) => o.id);
      const newSelected = [...new Set([...selectedOrderIds, ...paginatedIds])];
      setSelectedOrderIds(newSelected);
    } else {
      const paginatedIds = paginatedOrders.map((o: any) => o.id);
      setSelectedOrderIds(selectedOrderIds.filter(id => !paginatedIds.includes(id)));
    }
  };

  const handleSelectOrder = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter(item => item !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

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
                    <label>Địa Chỉ Giao Hàng <span style={{fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal'}}>(Nên chọn từ gợi ý của Google)</span></label>
                    {isLoaded && mapApiKey ? (
                      <Autocomplete onLoad={onLoadAutocomplete} onPlaceChanged={onPlaceChanged}>
                        <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Nhập địa chỉ và chọn từ danh sách gợi ý..." />
                      </Autocomplete>
                    ) : (
                      <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="VD: 137 Đặng Thái Thân, P. Thanh Vinh, Nghệ An" />
                    )}
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
            <div className="modal-overlay route-overlay">
              <div className="modal-content route-modal" role="dialog" aria-modal="true" aria-labelledby="route-title">
                <div className="route-modal-header">
                  <h2 id="route-title">Lộ trình giao hàng</h2>
                  <button type="button" className="route-close" onClick={() => setShowMap(false)}>Đóng ×</button>
                </div>

                <div className="route-modal-body">
                  <div className="route-setup">
                    <div className="route-origin">
                      <label htmlFor="route-home-address">Địa chỉ xuất phát</label>
                      <div className="route-origin-input">
                        <input id="route-home-address" type="text" value={homeAddress} onChange={e => {
                          setHomeAddress(e.target.value);
                          localStorage.setItem('orders_home_address', e.target.value);
                        }} placeholder="Nhập địa chỉ kho hoặc nhà" />
                        <button type="button" className="route-location" title="Lấy vị trí hiện tại" aria-label="Lấy vị trí hiện tại" onClick={handleGetCurrentLocation} disabled={!isLoaded || isMapLoading}>📍</button>
                      </div>
                    </div>
                    <button type="button" className="btn-primary route-optimize" onClick={handleOptimizeRoute} disabled={isMapLoading || !isLoaded}>
                      {isMapLoading ? 'Đang tính toán...' : 'Tối ưu lộ trình'}
                    </button>
                  </div>

                  {mapStatus && <p className="route-status" role="status">{mapStatus}</p>}

                  <div className="route-layout">
                    <section className="route-list-container" aria-label="Thứ tự giao hàng">
                      <div className="route-heading">
                        <h3>Thứ tự giao hàng</h3>
                        {optimizedOrders.length > 0 && <span>{optimizedOrders.length - 1} điểm giao</span>}
                      </div>
                      {mapUrl && (
                        <div className="route-actions">
                          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="route-maps-link" title="Mở lộ trình trong Google Maps">Mở Google Maps ↗</a>
                          <button type="button" className="route-copy" aria-label="Sao chép liên kết Google Maps" onClick={() => { navigator.clipboard.writeText(mapUrl); alert('Đã sao chép liên kết!'); }}>Sao chép</button>
                        </div>
                      )}
                      {optimizedOrders.length === 0 ? (
                        <p className="route-empty">Chọn đơn hàng trong danh sách, sau đó bấm “Tối ưu lộ trình” để xem thứ tự giao.</p>
                      ) : (
                        <div className="route-items">
                          {optimizedOrders.map((o, idx) => (
                            <div className={`route-item ${idx === 0 ? 'route-item-home' : ''}`} key={o.id}>
                              <div className="route-number">{idx === 0 ? '⌂' : idx}</div>
                              <div className="route-details">
                                <h4>{o.customer_name}{idx === 0 && <span> · Xuất phát</span>}</h4>
                                <p>{o.address}</p>
                                {o.product && <div className="route-product">{o.product}</div>}
                                {o.phone && <div className="route-phone">{o.phone}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                    <div className="map-container" aria-label="Bản đồ lộ trình">
                      {isLoaded && mapApiKey ? (
                        <GoogleMap mapContainerStyle={{width: '100%', height: '100%'}} center={{lat: 21.0285, lng: 105.8542}} zoom={12} options={{disableDefaultUI: true, zoomControl: true}}>
                          {directionsResult && <DirectionsRenderer directions={directionsResult} options={{suppressMarkers: true}} />}
                          {optimizedOrders.map((o, idx) => (
                            <Marker key={o.id} position={{lat: o.lat, lng: o.lon}} label={{text: idx === 0 ? 'H' : idx.toString(), color: 'white', fontWeight: 'bold'}} />
                          ))}
                        </GoogleMap>
                      ) : (
                        <div className="map-placeholder">{!mapApiKey ? 'Cần cấu hình Google Maps API Key để xem bản đồ' : 'Đang tải bản đồ...'}</div>
                      )}
                    </div>
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
                    <th style={{width: '40px'}}>
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={paginatedOrders.length > 0 && paginatedOrders.every((o: any) => selectedOrderIds.includes(o.id))}
                        title="Chọn tất cả trên trang này"
                      />
                    </th>
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
                    <tr key={order.id} style={{ opacity: order.is_deleted ? 0.7 : 1, background: selectedOrderIds.includes(order.id) ? '#f0fdf4' : '' }}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          disabled={order.is_deleted}
                        />
                      </td>
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
