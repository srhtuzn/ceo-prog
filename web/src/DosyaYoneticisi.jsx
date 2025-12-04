import { useState, useEffect } from "react";
import {
  Card,
  Button,
  Breadcrumb,
  List,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Empty,
  Row,
  Col,
  Space,
  Popconfirm,
  Tooltip,
  Statistic,
  Progress,
} from "antd";
import {
  FolderOpenFilled,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  PlusOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  ArrowUpOutlined,
  EditOutlined,
  DeleteOutlined,
  DragOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  CloseCircleOutlined,
  RestOutlined,
  UndoOutlined,
  ClearOutlined,
  HistoryOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

const API_URL = "http://localhost:3000";

// --- SÜRÜKLENEBİLİR BİLEŞENLER (Aynı Kaldı) ---
const DraggableDroppableKlasor = ({
  klasor,
  onClick,
  onDelete,
  copKutusuModu,
  onRestore,
  onHardDelete,
}) => {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `klasor-drop-${klasor.id}`,
    data: { type: "klasor", id: klasor.id },
    disabled: copKutusuModu,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
  } = useDraggable({
    id: `klasor-drag-${klasor.id}`,
    data: { type: "klasor_item", id: klasor.id },
    disabled: copKutusuModu,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: 0.5,
        cursor: "grabbing",
      }
    : undefined;

  return (
    <div ref={setDragRef} style={style} {...attributes}>
      <div
        ref={setDropRef}
        onClick={copKutusuModu ? null : onClick}
        style={{
          border: isOver ? "2px dashed #1890ff" : "1px solid #f0f0f0",
          borderRadius: 8,
          padding: 20,
          textAlign: "center",
          cursor: "pointer",
          background: isOver
            ? "#e6f7ff"
            : copKutusuModu
            ? "#fff1f0"
            : "#fafafa",
          position: "relative",
        }}
      >
        {!copKutusuModu && (
          <div
            {...listeners}
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              cursor: "grab",
              color: "#ccc",
            }}
          >
            <DragOutlined />
          </div>
        )}
        <FolderOpenFilled
          style={{
            fontSize: 40,
            color: copKutusuModu ? "#ff4d4f" : isOver ? "#1890ff" : "#faad14",
          }}
        />
        <div
          style={{
            marginTop: 10,
            fontWeight: "bold",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {klasor.ad}
        </div>
        <Space style={{ marginTop: 5 }}>
          {copKutusuModu ? (
            <>
              <Tooltip title="Geri Yükle">
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => onRestore(klasor.id, "klasor")}
                />
              </Tooltip>
              <Popconfirm
                title="Kalıcı Sil?"
                onConfirm={() => onHardDelete(klasor.id, "klasor")}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : (
            <Popconfirm
              title="Çöp Kutusuna?"
              onConfirm={(e) => {
                e.stopPropagation();
                onDelete(klasor.id);
              }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )}
        </Space>
      </div>
    </div>
  );
};

const DraggableDosya = ({
  dosya,
  getIcon,
  onEdit,
  onDelete,
  onCopy,
  onCut,
  copKutusuModu,
  onRestore,
  onHardDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `dosya-${dosya.id}`,
    data: { type: "dosya", id: dosya.id },
    disabled: copKutusuModu,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: 0.5,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        style={{
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          padding: "10px",
          textAlign: "center",
          background: copKutusuModu ? "#fff1f0" : "#fff",
          position: "relative",
        }}
      >
        {!copKutusuModu && (
          <div
            {...listeners}
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              cursor: "grab",
              color: "#ccc",
            }}
          >
            <DragOutlined />
          </div>
        )}
        <a
          href={copKutusuModu ? "#" : `${API_URL}/uploads/${dosya.fiziksel_ad}`}
          target="_blank"
          rel="noreferrer"
          style={{ display: "block", marginTop: 15, marginBottom: 10 }}
        >
          {getIcon(dosya.uzanti)}
        </a>
        <div
          style={{
            fontSize: 12,
            fontWeight: "500",
            marginBottom: 10,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={dosya.ad}
        >
          {dosya.ad}
        </div>
        <Space size={2}>
          {copKutusuModu ? (
            <>
              <Tooltip title="Geri Yükle">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<UndoOutlined />}
                  onClick={() => onRestore(dosya.id, "dosya")}
                />
              </Tooltip>
              <Popconfirm
                title="Kalıcı Sil?"
                onConfirm={() => onHardDelete(dosya.id, "dosya")}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : (
            <>
              <Tooltip title="Kopyala">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => onCopy(dosya)}
                />
              </Tooltip>
              <Tooltip title="Kes">
                <Button
                  type="text"
                  size="small"
                  icon={<ScissorOutlined />}
                  onClick={() => onCut(dosya)}
                />
              </Tooltip>
              <Tooltip title="Adı Değiştir">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(dosya)}
                />
              </Tooltip>
              <Popconfirm title="Sil?" onConfirm={() => onDelete(dosya.id)}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </>
          )}
        </Space>
      </div>
    </div>
  );
};

export default function DosyaYoneticisi({ aktifKullanici }) {
  const [icerik, setIcerik] = useState({
    klasorler: [],
    dosyalar: [],
    aktifKlasorAdi: "Ana Dizin",
  });
  const [aktifKlasorId, setAktifKlasorId] = useState(null);
  const [gecmis, setGecmis] = useState([{ id: null, ad: "Ana Dizin" }]);
  const [copKutusuModu, setCopKutusuModu] = useState(false);
  const [istatistik, setIstatistik] = useState(null); // Disk kullanımı vs.

  const [pano, setPano] = useState(null);
  const [klasorModal, setKlasorModal] = useState(false);
  const [dosyaModal, setDosyaModal] = useState(false);
  const [isimModalAcik, setIsimModalAcik] = useState(false);
  const [duzenlenecekDosya, setDuzenlenecekDosya] = useState(null);
  const [yeniDosyaAdi, setYeniDosyaAdi] = useState("");
  const [arama, setArama] = useState("");
  const [aramaSonuclar, setAramaSonuclar] = useState([]);

  useEffect(() => {
    if (copKutusuModu) {
      copKutusuVeriCek();
      istatistikCek();
    } else if (arama) {
      aramaYap(arama);
    } else {
      veriCek(aktifKlasorId);
    }
  }, [aktifKlasorId, arama, copKutusuModu]);

  const veriCek = (id) => {
    fetch(`${API_URL}/drive/icerik?klasor_id=${id}&userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => setIcerik(data));
  };

  const copKutusuVeriCek = () => {
    fetch(`${API_URL}/drive/cop-kutusu?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        setIcerik({
          klasorler: data.klasorler,
          dosyalar: data.dosyalar,
          aktifKlasorAdi: "Çöp Kutusu",
        });
      });
  };

  const istatistikCek = () => {
    fetch(`${API_URL}/drive/istatistik`)
      .then((r) => r.json())
      .then(setIstatistik);
  };

  const aramaYap = (val) => {
    if (val) {
      fetch(`${API_URL}/drive/ara?q=${val}`)
        .then((res) => res.json())
        .then((data) => setAramaSonuclar(data));
    }
  };

  // --- ACTIONS ---
  const kopyala = (dosya) => {
    setPano({ tur: "kopyala", dosya });
    message.info("Kopyalandı");
  };
  const kes = (dosya) => {
    setPano({ tur: "kes", dosya });
    message.info("Kesildi");
  };

  const yapistir = () => {
    if (!pano) return;
    const endpoint = pano.tur === "kes" ? "/drive/tasi" : "/drive/kopyala";
    fetch(`${API_URL}${endpoint}`, {
      method: pano.tur === "kes" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dosyaId: pano.dosya.id,
        hedefKlasorId: aktifKlasorId,
      }),
    }).then(() => {
      message.success("İşlem tamamlandı");
      if (pano.tur === "kes") setPano(null);
      veriCek(aktifKlasorId);
    });
  };

  // --- ÇÖP KUTUSU YÖNETİMİ (YENİ) ---
  const copuBosalt = () => {
    fetch(`${API_URL}/drive/copu-bosalt`, { method: "DELETE" }).then(() => {
      message.success("Çöp kutusu tamamen boşaltıldı!");
      copKutusuVeriCek();
      istatistikCek();
    });
  };

  const eskiDosyalariTemizle = () => {
    fetch(`${API_URL}/drive/otomatik-temizle`, { method: "DELETE" }).then(
      async (res) => {
        const data = await res.json();
        message.success(data.message);
        copKutusuVeriCek();
      }
    );
  };

  const klasorSil = (id) => {
    fetch(`${API_URL}/drive/klasor/${id}`, { method: "DELETE" }).then(() => {
      message.success("Çöpe taşındı");
      veriCek(aktifKlasorId);
    });
  };
  const dosyaSil = (id) => {
    fetch(`${API_URL}/drive/dosya/${id}`, { method: "DELETE" }).then(() => {
      message.success("Çöpe taşındı");
      veriCek(aktifKlasorId);
    });
  };
  const geriYukle = (id, tip) => {
    fetch(`${API_URL}/drive/geri-yukle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tip }),
    }).then(() => {
      message.success("Geri yüklendi");
      copKutusuVeriCek();
    });
  };
  const kaliciSil = (id, tip) => {
    fetch(`${API_URL}/drive/kalici-sil`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tip }),
    }).then(() => {
      message.success("Kalıcı silindi");
      copKutusuVeriCek();
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const tasinanTip = active.data.current.type;
    const tasinanId = active.data.current.id;
    if (over.data.current.type !== "klasor") return;
    const hedefId = over.data.current.id;
    if (parseInt(tasinanId) === parseInt(hedefId)) return;

    if (tasinanTip === "dosya") {
      fetch(`${API_URL}/drive/tasi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dosyaId: tasinanId, hedefKlasorId: hedefId }),
      }).then(() => {
        message.success("Taşındı");
        veriCek(aktifKlasorId);
      });
    } else if (tasinanTip === "klasor_item") {
      // Klasör taşıma henüz backend'de yoksa burası hata verebilir, kontrol edin.
    }
  };

  const klasorGir = (id, ad) => {
    setAktifKlasorId(id);
    setGecmis([...gecmis, { id, ad }]);
  };
  const yukariCik = () => {
    if (gecmis.length <= 1) return;
    const y = [...gecmis];
    y.pop();
    const u = y[y.length - 1];
    setAktifKlasorId(u.id);
    setGecmis(y);
  };
  const klasorOlustur = (v) => {
    fetch(`${API_URL}/drive/klasor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ad: v.ad,
        ust_klasor_id: aktifKlasorId,
        olusturan: aktifKullanici.ad_soyad,
      }),
    }).then(() => {
      message.success("Oluşturuldu");
      setKlasorModal(false);
      veriCek(aktifKlasorId);
    });
  };
  const dosyaYukle = ({ file, onSuccess }) => {
    const fd = new FormData();
    fd.append("dosya", file);
    fd.append("klasor_id", aktifKlasorId);
    fd.append("yukleyen", aktifKullanici.ad_soyad);
    fetch(`${API_URL}/drive/dosya`, { method: "POST", body: fd }).then(() => {
      message.success("Yüklendi");
      setDosyaModal(false);
      veriCek(aktifKlasorId);
      onSuccess("ok");
    });
  };
  const isimModalAc = (d) => {
    setDuzenlenecekDosya(d);
    setYeniDosyaAdi(d.ad.replace(d.uzanti || "", ""));
    setIsimModalAcik(true);
  };
  const dosyaIsmiDegistir = () => {
    if (!duzenlenecekDosya) return;
    fetch(`${API_URL}/drive/dosya/${duzenlenecekDosya.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yeniAd: yeniDosyaAdi }),
    }).then(() => {
      message.success("Güncellendi");
      setIsimModalAcik(false);
      veriCek(aktifKlasorId);
    });
  };

  const getIcon = (u) => {
    if (!u) return <FileOutlined style={{ fontSize: 32, color: "grey" }} />;
    if (u.includes("pdf"))
      return <FilePdfOutlined style={{ fontSize: 32, color: "red" }} />;
    if (u.match(/jpg|png|jpeg/))
      return <FileImageOutlined style={{ fontSize: 32, color: "purple" }} />;
    if (u.match(/xls|csv/))
      return <FileExcelOutlined style={{ fontSize: 32, color: "green" }} />;
    return <FileOutlined style={{ fontSize: 32, color: "grey" }} />;
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button
              disabled={gecmis.length <= 1 || copKutusuModu}
              icon={<ArrowUpOutlined />}
              onClick={yukariCik}
            />
            <Breadcrumb
              items={
                copKutusuModu
                  ? [{ title: "Çöp Kutusu" }]
                  : gecmis.map((g) => ({ title: g.ad }))
              }
            />
          </div>
        }
        extra={
          <Space>
            {/* ÇÖP KUTUSU İŞLEMLERİ */}
            {copKutusuModu ? (
              <>
                {istatistik && (
                  <span style={{ marginRight: 10, color: "#888" }}>
                    <DatabaseOutlined /> {istatistik.copteki_dosya} Öğe
                  </span>
                )}
                <Popconfirm
                  title="30 Günden eski dosyalar silinsin mi?"
                  onConfirm={eskiDosyalariTemizle}
                >
                  <Button icon={<HistoryOutlined />}>30 Günlük Temizlik</Button>
                </Popconfirm>
                <Popconfirm
                  title="Tüm çöp kutusu kalıcı olarak silinecek!"
                  onConfirm={copuBosalt}
                  okText="Evet, Boşalt"
                  cancelText="İptal"
                >
                  <Button danger icon={<ClearOutlined />}>
                    Çöpü Boşalt
                  </Button>
                </Popconfirm>
              </>
            ) : (
              pano && (
                <div
                  style={{
                    border: "1px dashed #1890ff",
                    padding: "0 10px",
                    borderRadius: 4,
                    background: "#e6f7ff",
                  }}
                >
                  <Space>
                    <span style={{ fontSize: 12, color: "#1890ff" }}>
                      {pano.tur === "kes" ? (
                        <ScissorOutlined />
                      ) : (
                        <CopyOutlined />
                      )}{" "}
                      <b>{pano.dosya.ad}</b>
                    </span>
                    <Button
                      type="primary"
                      size="small"
                      icon={<SnippetsOutlined />}
                      onClick={yapistir}
                    >
                      Yapıştır
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => setPano(null)}
                    />
                  </Space>
                </div>
              )
            )}

            <Button
              danger={!copKutusuModu}
              type={copKutusuModu ? "primary" : "default"}
              icon={copKutusuModu ? <ArrowUpOutlined /> : <RestOutlined />}
              onClick={() => {
                if (copKutusuModu) {
                  setCopKutusuModu(false);
                } else {
                  setCopKutusuModu(true);
                  setPano(null);
                  setArama("");
                }
              }}
            >
              {copKutusuModu ? "Dosyalara Dön" : "Çöp Kutusu"}
            </Button>

            {!copKutusuModu && (
              <>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Ara..."
                  onChange={(e) => setArama(e.target.value)}
                  style={{ width: 150 }}
                  allowClear
                />
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => setKlasorModal(true)}
                >
                  Klasör
                </Button>
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={() => setDosyaModal(true)}
                >
                  Yükle
                </Button>
              </>
            )}
          </Space>
        }
      >
        {arama && !copKutusuModu ? (
          <List
            header={<div>Sonuçlar: "{arama}"</div>}
            dataSource={aramaSonuclar}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <a
                    href={`${API_URL}/uploads/${item.fiziksel_ad}`}
                    target="_blank"
                  >
                    İndir
                  </a>,
                ]}
              >
                <List.Item.Meta title={item.ad} />
              </List.Item>
            )}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {icerik.klasorler.map((k) => (
              <Col span={4} key={k.id}>
                <DraggableDroppableKlasor
                  klasor={k}
                  onClick={() => klasorGir(k.id, k.ad)}
                  onDelete={klasorSil}
                  copKutusuModu={copKutusuModu}
                  onRestore={geriYukle}
                  onHardDelete={kaliciSil}
                />
              </Col>
            ))}
            {icerik.dosyalar.map((d) => (
              <Col span={4} key={d.id}>
                <DraggableDosya
                  dosya={d}
                  getIcon={getIcon}
                  onEdit={isimModalAc}
                  onDelete={dosyaSil}
                  onCopy={kopyala}
                  onCut={kes}
                  copKutusuModu={copKutusuModu}
                  onRestore={geriYukle}
                  onHardDelete={kaliciSil}
                />
              </Col>
            ))}
            {icerik.klasorler.length === 0 && icerik.dosyalar.length === 0 && (
              <Col span={24}>
                <Empty
                  description={copKutusuModu ? "Çöp kutusu boş" : "Klasör boş"}
                />
              </Col>
            )}
          </Row>
        )}

        <Modal
          title="Yeni Klasör"
          open={klasorModal}
          onCancel={() => setKlasorModal(false)}
          footer={null}
        >
          <Form onFinish={klasorOlustur} layout="vertical">
            <Form.Item name="ad" label="Ad" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Oluştur
            </Button>
          </Form>
        </Modal>
        <Modal
          title="Dosya Yükle"
          open={dosyaModal}
          onCancel={() => setDosyaModal(false)}
          footer={null}
        >
          <Upload.Dragger
            customRequest={dosyaYukle}
            showUploadList={false}
            multiple
          >
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p>Tıkla veya Sürükle</p>
          </Upload.Dragger>
        </Modal>
        <Modal
          title="Dosya Adı Değiştir"
          open={isimModalAcik}
          onOk={dosyaIsmiDegistir}
          onCancel={() => setIsimModalAcik(false)}
        >
          <Input
            value={yeniDosyaAdi}
            onChange={(e) => setYeniDosyaAdi(e.target.value)}
            addonAfter={duzenlenecekDosya?.uzanti}
          />
        </Modal>
      </Card>
    </DndContext>
  );
}
