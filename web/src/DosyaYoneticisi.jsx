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
  Tag,
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
  FolderOutlined,
} from "@ant-design/icons";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

const API_URL = "http://localhost:3000";

// --- SÜRÜKLENEBİLİR KLASÖR (YENİ) ---
// Klasör hem içine dosya alabilir (Droppable) hem de taşınabilir (Draggable)
const DraggableDroppableKlasor = ({
  klasor,
  onClick,
  onDelete,
  onEdit,
  copKutusuModu,
  onRestore,
  onHardDelete,
}) => {
  // 1. Drop Özelliği (İçine bir şey bırakılabilir mi?)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `klasor-drop-${klasor.id}`,
    data: { type: "klasor", id: klasor.id },
    disabled: copKutusuModu, // Çöp kutusundayken içine bir şey atılamaz
  });

  // 2. Drag Özelliği (Kendisi sürüklenebilir mi?)
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
        <div style={{ marginTop: 10, fontWeight: "bold" }}>{klasor.ad}</div>

        {/* Butonlar */}
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

// --- SÜRÜKLENEBİLİR DOSYA ---
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
  const [copKutusuModu, setCopKutusuModu] = useState(false); // <--- YENİ STATE

  const [pano, setPano] = useState(null);
  const [klasorModal, setKlasorModal] = useState(false);
  const [dosyaModal, setDosyaModal] = useState(false);
  const [isimModalAcik, setIsimModalAcik] = useState(false);
  const [duzenlenecekDosya, setDuzenlenecekDosya] = useState(null);
  const [yeniDosyaAdi, setYeniDosyaAdi] = useState("");
  const [arama, setArama] = useState("");
  const [aramaSonuclar, setAramaSonuclar] = useState([]);

  useEffect(() => {
    // 1. Eğer Çöp Kutusu Modundaysak -> Sadece Çöp Kutusunu Çek
    if (copKutusuModu) {
      copKutusuVeriCek();
      return; // Fonksiyonu burada kes, aşağıya inme
    }

    // 2. Eğer Arama Yapılıyorsa -> Normal veri çekmeyi durdur (Arama fonksiyonu yönetiyor)
    if (arama) {
      return;
    }

    // 3. Normal Moddaysak -> Klasör içeriğini çek
    veriCek(aktifKlasorId);
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

  // --- KLASÖR & DOSYA SİLME (SOFT DELETE) ---
  const klasorSil = (id) => {
    fetch(`${API_URL}/drive/klasor/${id}`, { method: "DELETE" }).then(() => {
      message.success("Klasör çöp kutusuna taşındı");
      veriCek(aktifKlasorId);
    });
  };
  const dosyaSil = (id) => {
    fetch(`${API_URL}/drive/dosya/${id}`, { method: "DELETE" }).then(() => {
      message.success("Dosya çöp kutusuna taşındı");
      veriCek(aktifKlasorId);
    });
  };

  // --- GERİ YÜKLEME & HARD DELETE ---
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
      message.success("Kalıcı olarak silindi");
      copKutusuVeriCek();
    });
  };

  // --- DND: TAŞIMA (KLASÖR VEYA DOSYA) ---
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    // Neyi taşıyoruz?
    const tasinanTip = active.data.current.type; // 'dosya' veya 'klasor_item'
    const tasinanId = active.data.current.id;

    // Nereye bırakıyoruz? (Sadece klasör içine bırakılabilir)
    if (over.data.current.type !== "klasor") return;
    const hedefId = over.data.current.id;

    if (parseInt(tasinanId) === parseInt(hedefId)) return; // Kendine bırakma

    if (tasinanTip === "dosya") {
      fetch(`${API_URL}/drive/tasi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dosyaId: tasinanId, hedefKlasorId: hedefId }),
      }).then(() => {
        message.success("Dosya taşındı");
        veriCek(aktifKlasorId);
      });
    } else if (tasinanTip === "klasor_item") {
      fetch(`${API_URL}/drive/klasor-tasi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klasorId: tasinanId, hedefKlasorId: hedefId }),
      }).then(() => {
        message.success("Klasör taşındı");
        veriCek(aktifKlasorId);
      });
    }
  };

  // Helperlar
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
      message.success("Klasör oluşturuldu");
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
      message.success("İsim güncellendi");
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
            {/* ÇÖP KUTUSU GEÇİŞ BUTONU */}
            <Button
              danger={!copKutusuModu}
              type={copKutusuModu ? "primary" : "default"}
              icon={copKutusuModu ? <ArrowUpOutlined /> : <RestOutlined />}
              onClick={() => {
                if (copKutusuModu) {
                  // Çöp kutusundan çıkılıyor -> Normal Mod
                  setCopKutusuModu(false);
                  // veriCek(aktifKlasorId) çağırmana gerek yok, useEffect 'copKutusuModu' değişince bunu yapacak.
                } else {
                  // Çöp kutusuna giriliyor
                  setCopKutusuModu(true);
                  setPano(null); // Kopyalama panosunu temizle
                  setArama(""); // Aramayı temizle
                }
              }}
            >
              {copKutusuModu ? "Dosyalara Dön" : "Çöp Kutusu"}
            </Button>

            {!copKutusuModu && (
              <>
                {pano && (
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
                )}
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
        {/* LİSTELEME ALANI */}
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

        {/* MODALLAR */}
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
