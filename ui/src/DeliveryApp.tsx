import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useJsApiLoader, GoogleMap, DirectionsRenderer, Marker, InfoWindow } from '@react-google-maps/api';

interface Customer {
  id: string;
  name: string;
  product: string;
  address: string;
  originalIndex: number;
  lat?: number;
  lon?: number;
}

const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '12px' };
const defaultCenter = { lat: 21.0285, lng: 105.8542 }; // Hanoi

function MapViewAndLogic({ apiKey, sheetUrl, setSheetUrl }: { apiKey: string; sheetUrl: string; setSheetUrl: (val: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [inputType, setInputType] = useState<'url' | 'file'>('file');
  
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [optimizedCustomers, setOptimizedCustomers] = useState<Customer[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const processRows = (rows: any[]) => {
    if (rows.length < 2) throw new Error('Cần ít nhất 2 địa chỉ (1 nhà, 1 khách) để tìm đường.');
      
    const customers: Customer[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const keys = Object.keys(row);
      const nameKey = keys.find(k => k.toLowerCase().includes('tên') || k.toLowerCase().includes('name') || k.toLowerCase().includes('khách'));
      const productKey = keys.find(k => k.toLowerCase().includes('sản phẩm') || k.toLowerCase().includes('hàng') || k.toLowerCase().includes('product'));
      const addressKey = keys.find(k => k.toLowerCase().includes('địa chỉ') || k.toLowerCase().includes('address') || k.toLowerCase().includes('dia chi'));
      
      const name = nameKey ? row[nameKey] : `Khách hàng ${i+1}`;
      const product = productKey ? row[productKey] : 'Hàng hóa';
      const address = addressKey ? row[addressKey] : '';
      
      if (address && typeof address === 'string' && address.trim()) {
        customers.push({ id: `cust-${i}`, name: String(name), product: String(product), address: address.trim(), originalIndex: i });
      }
    }

    if (customers.length < 2) throw new Error('Không tìm thấy đủ địa chỉ hợp lệ trong file.');
    if (customers.length > 25) throw new Error('Google Maps chỉ hỗ trợ tối đa 25 địa chỉ (bao gồm cả điểm đi/về) trong 1 lần tìm đường.');

    setStatus('Đang kết nối Google Maps để tìm lộ trình tối ưu...');
    
    const directionsService = new window.google.maps.DirectionsService();
    
    const origin = customers[0].address;
    const waypoints = customers.slice(1).map(c => ({
      location: c.address,
      stopover: true
    }));

      directionsService.route({
        origin: origin,
        destination: origin,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResult(result);
          const order = result.routes[0].waypoint_order;
          const legs = result.routes[0].legs;
          
          const ordered: Customer[] = [{
            ...customers[0],
            lat: legs[0].start_location.lat(),
            lon: legs[0].start_location.lng()
          }];
          
          order.forEach((index, i) => {
            ordered.push({
              ...customers[index + 1],
              lat: legs[i].end_location.lat(),
              lon: legs[i].end_location.lng()
            });
          });
          
          setOptimizedCustomers(ordered);
          setStatus('Hoàn tất! Google Maps đã tối ưu hóa lộ trình.');
          setLoading(false);
        } else {
          setStatus('');
          setLoading(false);
          alert(`Lỗi từ Google Maps: ${status}. Hãy kiểm tra xem API Key của bạn đã bật Directions API chưa.`);
        }
      });
  };

  const handleSyncUrl = async () => {
    if (!sheetUrl) return alert('Vui lòng nhập link CSV từ Google Sheets!');
    if (!isLoaded) return alert('Bản đồ chưa tải xong, vui lòng đợi giây lát!');
    
    setLoading(true);
    setOptimizedCustomers([]);
    setDirectionsResult(null);
    
    try {
      setStatus('Đang tải dữ liệu từ Google Sheets...');
      const res = await fetch(sheetUrl);
      if (!res.ok) throw new Error('Không thể tải file CSV. Hãy kiểm tra lại link.');
      const csv = await res.text();
      const parsed = Papa.parse<any>(csv, { header: true, skipEmptyLines: true });
      processRows(parsed.data);
    } catch (error: any) {
      alert(error.message || 'Có lỗi xảy ra');
      setStatus('');
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isLoaded) return alert('Bản đồ chưa tải xong, vui lòng đợi giây lát!');

    setLoading(true);
    setOptimizedCustomers([]);
    setDirectionsResult(null);
    setStatus('Đang đọc file của bạn...');

    const reader = new FileReader();
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
          processRows(parsed.data);
        } catch (err: any) {
          alert('Lỗi đọc file CSV: ' + err.message);
          setStatus('');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        alert('Không thể đọc file CSV');
        setStatus('');
        setLoading(false);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);
          processRows(rows);
        } catch (err: any) {
          alert('Lỗi đọc file Excel: ' + err.message);
          setStatus('');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        alert('Không thể đọc file Excel');
        setStatus('');
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    }
    
    // reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button 
          className="btn-primary" 
          style={{ background: inputType === 'file' ? 'var(--primary)' : 'transparent', color: inputType === 'file' ? 'white' : 'var(--text-main)', border: '1px solid var(--primary)', marginRight: '1rem', padding: '0.5rem 1rem' }} 
          onClick={() => setInputType('file')}
        >
          📂 Upload File Excel / CSV
        </button>
        <button 
          className="btn-primary" 
          style={{ background: inputType === 'url' ? 'var(--primary)' : 'transparent', color: inputType === 'url' ? 'white' : 'var(--text-main)', border: '1px solid var(--primary)', padding: '0.5rem 1rem' }} 
          onClick={() => setInputType('url')}
        >
          🌐 Link Google Sheets
        </button>
      </div>

      <div className="input-group" style={{ margin: '0 auto', maxWidth: '800px', marginBottom: '1rem' }}>
        {inputType === 'url' ? (
          <>
            <input 
              type="text" 
              className="input-field" 
              placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv" 
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              disabled={loading}
            />
            <button className="btn-primary" onClick={handleSyncUrl} disabled={loading || !sheetUrl || !isLoaded}>
              {loading ? <><span className="loader"></span> Đang xử lý...</> : 'Đồng bộ Google Sheets'}
            </button>
          </>
        ) : (
          <div style={{ width: '100%', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
              disabled={loading}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn-primary" style={{ display: 'inline-block', cursor: loading ? 'not-allowed' : 'pointer', width: '100%', textAlign: 'center' }}>
              {loading ? <><span className="loader"></span> Đang xử lý...</> : 'Bấm vào đây để chọn File Excel / CSV từ máy'}
            </label>
          </div>
        )}
      </div>

      {status && <p className="status-message" style={{textAlign: 'center', marginBottom: '1rem'}}>{status}</p>}
      {loadError && <p className="status-message" style={{color: 'red', textAlign: 'center', marginBottom: '1rem'}}>Lỗi tải Google Maps: {loadError.message}</p>}

      <div className="content-grid">
        <div className="route-list-container">
          <h2>📋 Lộ trình giao hàng (Bởi Google)</h2>
          {optimizedCustomers.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
              Chưa có dữ liệu. Vui lòng nhập dữ liệu để xem lộ trình.
            </div>
          )}
          {optimizedCustomers.map((cust, index) => (
            <div className="route-item" key={cust.id}>
              <div className="route-number">{index + 1}</div>
              <div className="route-details">
                <h3>{cust.name} {index === 0 ? '(Điểm xuất phát)' : ''}</h3>
                <p>{cust.address}</p>
                {index !== 0 && <span className="product-tag">📦 {cust.product}</span>}
              </div>
            </div>
          ))}
          {optimizedCustomers.length > 0 && (
             <div className="route-item" style={{ opacity: 0.7, borderLeftColor: '#9CA3AF' }}>
                <div className="route-number" style={{ background: '#9CA3AF' }}>🏠</div>
                <div className="route-details">
                  <h3>Quay về nhà</h3>
                  <p>{optimizedCustomers[0].address}</p>
                </div>
             </div>
          )}
        </div>

        <div className="map-container">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={12}
              options={{ disableDefaultUI: true, zoomControl: true }}
            >
              {directionsResult && <DirectionsRenderer directions={directionsResult} options={{ suppressMarkers: true }} />}
              
              {optimizedCustomers.map((cust, index) => (
                <Marker 
                  key={cust.id} 
                  position={{ lat: cust.lat!, lng: cust.lon! }} 
                  label={{ text: (index + 1).toString(), color: 'white', fontWeight: 'bold' }}
                />
              ))}
            </GoogleMap>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
              Đang tải dữ liệu bản đồ...
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DeliveryApp() {
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('delivery_gmaps_api_key') || '');
  const [activeApiKey, setActiveApiKey] = useState(() => localStorage.getItem('delivery_gmaps_api_key') || '');
  const [sheetUrl, setSheetUrl] = useState('');

  const handleSaveApiKey = () => {
    localStorage.setItem('delivery_gmaps_api_key', apiKeyInput);
    setActiveApiKey(apiKeyInput);
  };

  return (
    <div className="delivery-container">
      <div className="header-glass">
        <h1>🚀 Smart Delivery Route</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Tối ưu hóa đường đi của bạn một cách nhanh chóng và bảo mật.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px', margin: '0 auto', marginBottom: '1rem' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Nhập Google Maps API Key (Bắt buộc)..." 
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button className="btn-primary" onClick={handleSaveApiKey} disabled={apiKeyInput === activeApiKey}>
              {apiKeyInput === activeApiKey ? 'Đã lưu Key' : 'Lưu API Key'}
            </button>
          </div>
          
          {!activeApiKey && (
             <div className="input-group" style={{ margin: 0 }}>
               <button className="btn-primary" style={{ width: '100%', background: '#9CA3AF' }} disabled>
                 Vui lòng nhập API Key để bắt đầu
               </button>
             </div>
          )}
        </div>
      </div>

      {activeApiKey ? (
        <MapViewAndLogic apiKey={activeApiKey} sheetUrl={sheetUrl} setSheetUrl={setSheetUrl} />
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
          Bạn cần lưu API Key của Google Maps để ứng dụng có thể hiển thị bản đồ và tìm đường.
        </div>
      )}
    </div>
  );
}
