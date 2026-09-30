import { useEffect, useState } from 'react';
import ContentEditor from './ContentEditor';
import { describeUnsupportedEmoji } from '../../src/emoji/compatibility';

type Content = { id: string; text: string; images: string[]; topic?: string | null };
type Product = { id: string; name: string; order?: number; contents: Content[] };
type Config = { intervalMinutes: number; timeZone: string };
type Catalog = { products: Product[]; config: Config; revision: string };
type PreviewPost = {
  id: string; productId: string; contentId: string; text: string; topic: string | null;
  images: string[]; scheduledAt: string; status: string;
};
type Preview = {
  date: string; slot: 'morning' | 'afternoon'; dayNumber: number | null;
  intervalMinutes: number; existing: boolean; blocked: boolean; posts: PreviewPost[];
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result as T;
}

function nextId(prefix: string, ids: string[]): string {
  let number = 1;
  while (ids.includes(`${prefix}${number}`)) number++;
  return `${prefix}${number}`;
}

function imageUrl(imagePath: string): string {
  const parts = imagePath.replace(/^data\/media\//, '').split('/');
  return `/api/media/${parts.map(encodeURIComponent).join('/')}`;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<Config>({ intervalMinutes: 10, timeZone: 'Asia/Ho_Chi_Minh' });
  const [revision, setRevision] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(0);
  const [selectedContent, setSelectedContent] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editorLoadKey, setEditorLoadKey] = useState(0);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const catalog = await api<Catalog>('/api/catalog');
      setProducts(catalog.products);
      setConfig(catalog.config);
      setRevision(catalog.revision);
      setSelectedProduct(0);
      setSelectedContent(0);
      setDirty(false);
      setPreview(null);
      setEditorLoadKey(previous => previous + 1);
      setNotice('Đã tải dữ liệu mới nhất.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const product = products[selectedProduct];
  const content = product?.contents[selectedContent];
  const hasUnsupportedEmoji = products.some(item => item.contents.some(variant => describeUnsupportedEmoji(variant.text)));

  function editProducts(change: (draft: Product[]) => void) {
    setProducts(previous => {
      const draft = structuredClone(previous);
      change(draft);
      return draft;
    });
    setDirty(true);
    setPreview(null);
    setError('');
    setNotice('');
  }

  function editProduct(change: (draft: Product) => void) {
    editProducts(draft => { if (draft[selectedProduct]) change(draft[selectedProduct]); });
  }

  function editContent(change: (draft: Content) => void) {
    editProduct(draft => { if (draft.contents[selectedContent]) change(draft.contents[selectedContent]); });
  }

  function addProduct() {
    const id = nextId('product-', products.map(item => item.id));
    editProducts(draft => draft.push({ id, name: '', contents: [{ id: 'v1', text: '', images: [], topic: null }] }));
    setSelectedProduct(products.length);
    setSelectedContent(0);
  }

  function moveProduct(direction: number) {
    const destination = selectedProduct + direction;
    if (destination < 0 || destination >= products.length) return;
    editProducts(draft => {
      [draft[selectedProduct], draft[destination]] = [draft[destination], draft[selectedProduct]];
    });
    setSelectedProduct(destination);
  }

  function removeProduct() {
    if (!product || !window.confirm(`Xóa sản phẩm “${product.name || product.id}” khỏi danh mục đang soạn?`)) return;
    editProducts(draft => draft.splice(selectedProduct, 1));
    setSelectedProduct(Math.max(0, selectedProduct - 1));
    setSelectedContent(0);
  }

  function addContent() {
    if (!product) return;
    const index = product.contents.length;
    const id = nextId('v', product.contents.map(item => item.id));
    editProduct(draft => draft.contents.push({ id, text: '', images: [], topic: null }));
    setSelectedContent(index);
  }

  function moveContent(direction: number) {
    if (!product) return;
    const destination = selectedContent + direction;
    if (destination < 0 || destination >= product.contents.length) return;
    editProduct(draft => {
      [draft.contents[selectedContent], draft.contents[destination]] = [draft.contents[destination], draft.contents[selectedContent]];
    });
    setSelectedContent(destination);
  }

  function removeContent() {
    if (!product || !content || product.contents.length <= 1) return;
    editProduct(draft => draft.contents.splice(selectedContent, 1));
    setSelectedContent(Math.max(0, selectedContent - 1));
  }

  function moveImage(index: number, direction: number) {
    if (!content) return;
    const destination = index + direction;
    if (destination < 0 || destination >= content.images.length) return;
    editContent(draft => {
      [draft.images[index], draft.images[destination]] = [draft.images[destination], draft.images[index]];
    });
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length || !product || !content) return;
    const productId = product.id;
    const contentId = content.id;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        const result = await api<{ path: string }>(`/api/media?productId=${encodeURIComponent(productId)}`, { method: 'POST', body });
        editProducts(draft => {
          const target = draft.find(item => item.id === productId)?.contents.find(item => item.id === contentId);
          if (target) target.images.push(result.path);
        });
      }
      setNotice('Media đã được tải lên máy. Bấm Lưu để gắn vào nội dung.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<Catalog>('/api/catalog', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, config, revision })
      });
      setProducts(result.products);
      setConfig(result.config);
      setRevision(result.revision);
      setDirty(false);
      setNotice('Đã lưu. Dữ liệu sẵn sàng cho post.bat.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function showPreview(slot: 'morning' | 'afternoon') {
    if (dirty) {
      setError('Hãy bấm Lưu trước khi xem trước lịch đăng.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setPreview(await api<Preview>(`/api/preview?slot=${slot}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">◎</span><span>Threads Studio<small>Local editor</small></span></div>
        <div className="sidebar-heading"><span>Sản phẩm <strong>{products.length}</strong></span><button className="small-button" onClick={addProduct}>+ Thêm</button></div>
        <div className="product-list">
          {products.map((item, index) => (
            <button className={`product-item ${selectedProduct === index ? 'active' : ''}`} key={`${item.id}-${index}`}
              onClick={() => { setSelectedProduct(index); setSelectedContent(0); setPreview(null); }}>
              <span className="product-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="product-title">{item.name || 'Sản phẩm chưa đặt tên'}<small>{item.contents.length} phiên bản · {item.id}</small></span>
            </button>
          ))}
          {!products.length && <p className="sidebar-empty">Chưa có sản phẩm. Thêm sản phẩm đầu tiên để bắt đầu.</p>}
        </div>
        <div className="sidebar-footer">Dữ liệu lưu trên máy của bạn<br /><code>data/products.json</code></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><h2>Chuẩn bị bài đăng</h2></div>
          <div className="top-actions">
            <button className="button secondary" style={{ border: '1px solid #10b981', color: '#059669', background: '#ecfdf5', fontWeight: 'bold' }} onClick={() => window.open('/orders.html', '_blank')} title="Mở trang Quản lý Đơn Hàng">📦 Quản lý Đơn</button>
            <span className={`save-state ${dirty ? 'unsaved' : ''}`}>{dirty ? '● Chưa lưu' : '✓ Đã lưu'}</span>
            <button className="button secondary" onClick={() => void load()} disabled={busy}>Tải lại</button>
            <button className="button primary" onClick={() => void save()} disabled={!dirty || busy || uploading || hasUnsupportedEmoji}>{busy ? 'Đang xử lý…' : 'Lưu dữ liệu'}</button>
          </div>
        </header>

        <div className="content-area">
          {error && <div className="alert error" role="alert">{error}</div>}
          {notice && <div className="alert success">{notice}</div>}

          {product ? <>
            <section className="panel product-panel">
              <div className="panel-title"><div><div className="eyebrow">SẢN PHẨM {selectedProduct + 1} / {products.length}</div><h2>Thông tin sản phẩm</h2></div><div className="inline-actions"><button onClick={() => moveProduct(-1)} disabled={selectedProduct === 0}>↑ Trước</button><button onClick={() => moveProduct(1)} disabled={selectedProduct === products.length - 1}>↓ Sau</button><button className="danger-link" onClick={removeProduct}>Xóa</button></div></div>
              <div className="form-grid">
                <label>Tên sản phẩm<input value={product.name} onChange={event => editProduct(draft => { draft.name = event.target.value; })} placeholder="Ví dụ: Squishy hình gấu" /></label>
                <label>Mã sản phẩm <span className="field-hint">Chỉ chữ, số, _ và -</span><input value={product.id} onChange={event => editProduct(draft => { draft.id = event.target.value; })} placeholder="product-a" /></label>
              </div>
            </section>

            <section className="panel editor-panel">
              <div className="panel-title"><div><div className="eyebrow">NỘI DUNG XOAY VÒNG</div><h2>Các phiên bản bài viết</h2></div><button className="button subtle" onClick={addContent}>+ Thêm phiên bản</button></div>
              <div className="variant-tabs">{product.contents.map((item, index) => <button key={`${item.id}-${index}`} className={selectedContent === index ? 'selected' : ''} onClick={() => setSelectedContent(index)}>Ngày {index + 1}<span>{item.id}</span></button>)}</div>
              {content && <div className="variant-body">
                <div className="variant-header"><strong>Phiên bản {selectedContent + 1}</strong><div className="inline-actions"><button onClick={() => moveContent(-1)} disabled={selectedContent === 0}>←</button><button onClick={() => moveContent(1)} disabled={selectedContent === product.contents.length - 1}>→</button><button className="danger-link" onClick={removeContent} disabled={product.contents.length <= 1}>Xóa phiên bản</button></div></div>
                <div className="form-grid"><label>Mã phiên bản<input value={content.id} onChange={event => editContent(draft => { draft.id = event.target.value; })} placeholder="a1" /></label><label>Community or topic <span className="field-hint">Không bắt buộc</span><input value={content.topic || ''} onChange={event => editContent(draft => { draft.topic = event.target.value || null; })} placeholder="squishy" /></label></div>
                <div className="full-label"><div className="editor-field-label">Nội dung bài viết</div><ContentEditor key={`${editorLoadKey}-${selectedProduct}-${selectedContent}`} value={content.text} onChange={text => editContent(draft => { draft.text = text; })} /><span className="field-hint">Nội dung được lưu thành văn bản thuần cho Threads. Mỗi sản phẩm dùng lần lượt phiên bản 1, 2, 3 rồi quay về phiên bản 1.</span></div>
                <div className="media-heading"><div><strong>Hình ảnh & Video <span className="count">{content.images.length}</span></strong><p>Media sẽ đăng theo thứ tự bên dưới. JPG, PNG, WebP, MP4 hoặc MOV.</p></div><label className="button subtle upload-button">{uploading ? 'Đang tải media…' : '+ Tải media lên'}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple disabled={uploading || !/^[a-zA-Z0-9_-]+$/.test(product.id)} onChange={event => { void uploadImages(event.target.files); event.target.value = ''; }} /></label></div>
                <div className="image-grid">{content.images.map((image, index) => <div className="image-card" key={`${image}-${index}`}>{image.match(/\.(mp4|mov)$/i) ? <video src={imageUrl(image)} autoPlay muted loop style={{ height: '120px', width: '100%', objectFit: 'cover', background: '#edf2f3' }} /> : <img src={imageUrl(image)} alt={`Media ${index + 1}`} />}<div><span>Media {index + 1}</span><div className="inline-actions"><button onClick={() => moveImage(index, -1)} disabled={index === 0}>←</button><button onClick={() => moveImage(index, 1)} disabled={index === content.images.length - 1}>→</button><button className="danger-link" onClick={() => editContent(draft => { draft.images.splice(index, 1); })}>Xóa</button></div></div><small title={image}>{image.split('/').at(-1)}</small></div>)}{!content.images.length && <div className="media-empty">Chưa có media. Bài viết có thể chỉ gồm chữ.</div>}</div>
              </div>}
            </section>
          </> : <section className="panel empty-panel"><span className="empty-icon">✦</span><h2>Bắt đầu với sản phẩm đầu tiên</h2><p>Thêm sản phẩm, tạo các phiên bản nội dung theo ngày và tải ảnh lên. Sau đó bấm Lưu để dùng với file post.bat.</p><button className="button primary" onClick={addProduct}>+ Thêm sản phẩm</button></section>}

          <section className="panel schedule-panel"><div className="panel-title"><div><div className="eyebrow">LỊCH ĐĂNG</div><h2>Xem trước lượt chạy</h2></div></div><div className="schedule-settings"><label>Khoảng cách giữa các bài <div className="input-suffix"><input type="number" min="1" step="1" value={config.intervalMinutes} onChange={event => { setConfig(previous => ({ ...previous, intervalMinutes: Number(event.target.value) })); setDirty(true); setPreview(null); }} /><span>phút</span></div></label><label>Múi giờ<input value={config.timeZone} onChange={event => { setConfig(previous => ({ ...previous, timeZone: event.target.value })); setDirty(true); setPreview(null); }} /></label><div className="preview-actions"><button className="button secondary" onClick={() => void showPreview('morning')} disabled={busy}>Xem lượt sáng</button><button className="button secondary" onClick={() => void showPreview('afternoon')} disabled={busy}>Xem lượt chiều</button></div></div>
            {preview && <div className="preview-result"><div className="preview-header"><strong>{preview.slot === 'morning' ? 'Lượt sáng' : 'Lượt chiều'} · {preview.date} · Ngày nội dung {preview.dayNumber ?? '—'}</strong><span>{preview.existing ? 'Lượt đã được tạo' : 'Bản xem trước'}</span></div>{preview.blocked && <p className="preview-warning">Lượt còn lại trong ngày chưa hoàn tất. Hãy hoàn thành lượt đó trước khi bắt đầu lượt này.</p>}{preview.posts.length ? <ol>{preview.posts.map((post, index) => <li key={post.id}><span className="preview-number">{index + 1}</span><div><strong>{products.find(item => item.id === post.productId)?.name || post.productId}</strong><small>{post.contentId} · {new Date(post.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: config.timeZone })}{post.topic ? ` · topic: ${post.topic}` : ''}{post.images.length ? ` · ${post.images.length} ảnh` : ''}</small><p>{post.text || '(bài chỉ có ảnh)'}</p></div><span className="preview-status">{post.status}</span></li>)}</ol> : <p className="no-preview">Chưa có sản phẩm nào để xem trước.</p>}</div>}
            <div className="run-note"><span>▶</span><p>Sau khi lưu, mở <strong>post.bat</strong> và chọn lượt sáng hoặc chiều. Bản xem trước không đăng bài.</p></div>
          </section>
        </div>
      </main>
    </div>
  );
}
